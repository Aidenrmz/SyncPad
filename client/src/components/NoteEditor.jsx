import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TextareaAutosize from 'react-textarea-autosize';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faSpinner, faCopy, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useSocket } from '../contexts/useSocket';
import { API_URL } from '../config';

const USERNAME_STORAGE_KEY = 'syncpad-username';

const NoteEditor = () => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [note, setNote] = useState({ title: '', content: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [username, setUsername] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const saveTimeoutRef = useRef(null);
  const copyStatusTimeoutRef = useRef(null);
  const usernameInputRef = useRef(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      const randomUsername = `User-${Math.floor(1000 + Math.random() * 9000)}`;
      setUsername(randomUsername);
      localStorage.setItem(USERNAME_STORAGE_KEY, randomUsername);
    }
  }, []);

  useEffect(() => {
    document.title = note.title ? `${note.title} | SyncPad` : 'SyncPad';
  }, [note.title]);

  useEffect(() => () => {
    clearTimeout(saveTimeoutRef.current);
    clearTimeout(copyStatusTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!username) return;

    const fetchNote = async () => {
      setIsLoading(true);
      setError('');
      try {
        const apiUrl = `${API_URL}/api/notes/${noteId}`;
        
        const response = await axios.get(apiUrl, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 10000
        });
        
        setNote({
          title: response.data.title,
          content: response.data.content
        });
        setLastSaved(new Date(response.data.updatedAt).toLocaleTimeString());
      } catch (err) {
        console.error('Error fetching note:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            headers: err.config?.headers
          }
        });
        
        if (err.response?.status === 404) {
          setError('Note not found. It may have been deleted.');
        } else if (err.response?.status === 400) {
          setError('Invalid note ID format.');
        } else if (err.code === 'ECONNABORTED') {
          setError('Request timed out. Please check your connection and try again.');
        } else {
          setError('Failed to load note. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [noteId, username]);

  useEffect(() => {
    if (!socket || !isConnected || !username) return;

    const handleNoteContent = ({ title, content, activeUsers: users = [] }) => {
      setNote({ title, content });
      setActiveUsers(users);
    };

    const handleNoteUpdate = (data) => {
      if (data.userId !== socket.id) {
        setNote(prev => ({
          ...prev,
          content: data.content,
        }));
      }
      setLastSaved(new Date().toLocaleTimeString());
    };

    const handleActiveUsers = ({ users }) => {
      setActiveUsers(users);
    };

    socket.emit('join_note', { 
      noteId,
      username
    });

    socket.on('note_content', handleNoteContent);
    socket.on('note_updated', handleNoteUpdate);
    socket.on('active_users', handleActiveUsers);
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.off('note_content', handleNoteContent);
      socket.off('note_updated', handleNoteUpdate);
      socket.off('active_users', handleActiveUsers);
      socket.off('error');
    };
  }, [socket, isConnected, noteId, username]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setNote(prev => ({
      ...prev,
      content: newContent
    }));

    if (socket && isConnected) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        socket.emit('note_update', {
          noteId,
          content: newContent
        });
      }, 300);
    }
  };

  const copyNoteLink = async () => {
    const url = `${window.location.origin}/notes/${noteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Copied');
    } catch (error) {
      console.error('Failed to copy note link:', error);
      setCopyStatus('Copy failed');
    }

    clearTimeout(copyStatusTimeoutRef.current);
    copyStatusTimeoutRef.current = setTimeout(() => setCopyStatus(''), 2000);
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    localStorage.setItem(USERNAME_STORAGE_KEY, newUsername);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="mb-4 text-4xl text-cyan-400" />
          <p className="text-gray-300">Loading pad...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-8 text-center shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-red-300">Error</h2>
          <p className="mb-6 text-gray-300">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded bg-cyan-500 px-4 py-2 font-medium text-gray-950 transition-colors hover:bg-cyan-400"
          >
            Go to SyncPad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-300 transition-colors hover:text-cyan-300"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Back
            </button>
            
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-cyan-300">SyncPad</span>
              <span className="text-sm font-medium text-gray-300">You are:</span>
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className="w-32 border-b border-gray-500 bg-transparent px-1 py-0.5 text-sm text-gray-100 placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                ref={usernameInputRef}
                style={{ color: 'inherit' }}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <FontAwesomeIcon icon={faUsers} className="mr-1" />
              <span>{activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'} online</span>
            </div>
            <button
              onClick={copyNoteLink}
              className="flex min-w-20 items-center justify-center rounded bg-cyan-500 px-3 py-1 text-sm font-medium text-gray-950 transition-colors hover:bg-cyan-400"
              title="Copy note link"
            >
              <FontAwesomeIcon icon={faCopy} className="mr-1.5" />
              {copyStatus || 'Share'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 text-gray-100">
        <h1 className="text-3xl font-bold mb-6 text-white">{note.title}</h1>
        
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 overflow-hidden">
          <TextareaAutosize
            value={note.content}
            onChange={handleContentChange}
            className="w-full p-4 focus:outline-none resize-none min-h-[300px] text-gray-100 leading-relaxed bg-transparent placeholder-gray-500"
            style={{ color: 'inherit' }}
            placeholder="Start typing your note here..."
            disabled={!isConnected}
          />
        </div>

        {!isConnected && (
          <div className="mt-2 text-sm text-yellow-600 flex items-center">
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
            Connecting to server...
          </div>
        )}

        {lastSaved && (
          <div className="mt-4 text-sm text-gray-400">
            Last saved at {lastSaved}
          </div>
        )}
      </main>
    </div>
  );
};

export default NoteEditor;
