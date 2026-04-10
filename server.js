require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const DEFAULT_CLIENT_ORIGINS = ['http://localhost:3000'];

const parseAllowedOrigins = (value) => {
  if (!value) {
    return DEFAULT_CLIENT_ORIGINS;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN);
const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Database connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Note Schema
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// API Routes
app.post('/api/notes', async (req, res) => {
  try {
    const { title } = req.body;
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const note = new Note({ title: trimmedTitle });
    await note.save();
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.get('/api/notes/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid note ID format' });
    }
    
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ 
      error: 'Failed to fetch note',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    const { content } = req.body;
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { content, updatedAt: Date.now() },
      { new: true }
    );
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Socket.IO Connection Handling
const activeUsers = new Map();

const getDefaultUsername = (socket) => `User-${socket.id.slice(0, 5)}`;

const getRoomUsers = (roomId) => {
  if (!activeUsers.has(roomId)) {
    activeUsers.set(roomId, new Map());
  }

  return activeUsers.get(roomId);
};

const serializeRoomUsers = (roomId) => (
  Array.from(activeUsers.get(roomId)?.entries() || [])
    .map(([id, username]) => ({ id, username }))
);

const removeActiveUser = (roomId, socketId) => {
  const users = activeUsers.get(roomId);
  if (!users) {
    return null;
  }

  const username = users.get(socketId);
  if (!username) {
    return null;
  }

  users.delete(socketId);
  if (users.size === 0) {
    activeUsers.delete(roomId);
  }

  return username;
};

const handleUserConnection = (socket) => {
  console.log('New client connected');
  let currentRoom = null;

  socket.on('join_note', async ({ noteId, username }) => {
    try {
      const note = await Note.findById(noteId);
      if (!note) {
        socket.emit('error', 'Note not found');
        return;
      }

      const displayName = username?.trim() || getDefaultUsername(socket);
      const isChangingRooms = currentRoom && currentRoom !== noteId;

      if (isChangingRooms) {
        const previousUsername = removeActiveUser(currentRoom, socket.id);
        socket.leave(currentRoom);
        if (previousUsername) {
          socket.to(currentRoom).emit('user_left', {
            userId: socket.id,
            username: previousUsername
          });
          updateActiveUsers(currentRoom);
        }
      }

      currentRoom = noteId;
      socket.join(noteId);
      const roomUsers = getRoomUsers(noteId);
      const isNewUser = !roomUsers.has(socket.id);
      roomUsers.set(socket.id, displayName);
      
      socket.emit('note_content', { 
        content: note.content, 
        title: note.title,
        activeUsers: serializeRoomUsers(noteId)
      });
      
      if (isNewUser) {
        socket.to(noteId).emit('user_joined', { 
          userId: socket.id,
          username: displayName
        });
      }
      
      updateActiveUsers(noteId);
    } catch (error) {
      console.error('Error joining note:', error);
      socket.emit('error', 'Failed to join note');
    }
  });

  socket.on('note_update', async ({ noteId, content }) => {
    try {
      const note = await Note.findByIdAndUpdate(
        noteId,
        { content, updatedAt: Date.now() },
        { new: true }
      );
      if (note) {
        socket.to(noteId).emit('note_updated', { 
          content: note.content, 
          updatedAt: note.updatedAt,
          userId: socket.id
        });
      }
    } catch (error) {
      console.error('Error updating note:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (currentRoom) {
      const username = removeActiveUser(currentRoom, socket.id);
      if (username) {
        socket.to(currentRoom).emit('user_left', { 
          userId: socket.id,
          username
        });
        updateActiveUsers(currentRoom);
      }
    }
  });
};

const updateActiveUsers = (roomId) => {
  io.to(roomId).emit('active_users', { users: serializeRoomUsers(roomId) });
};

io.on('connection', handleUserConnection);

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await connectToDatabase();
  server.listen(PORT, () => {
    console.log(`SyncPad server running on port ${PORT}`);
  });
};

startServer();
