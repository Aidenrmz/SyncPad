require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.model("Note", noteSchema);

app.post("/api/notes", async (req, res) => {
  const title = req.body.title?.trim();
  if (!title) return res.status(400).json({ error: "Title is required" });
  const note = await Note.create({ title });
  res.status(201).json(note);
});

app.get("/api/notes/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid note ID format" });
  }
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
});

app.put("/api/notes/:id", async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { content: req.body.content, updatedAt: Date.now() },
    { new: true }
  );
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log("SyncPad API running"));
});