const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "notes.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));

function readNotes() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

function cleanNote(input) {
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  const category = String(input.category || "Personal").trim() || "Personal";
  if (!title) throw new Error("Please enter a note title.");
  if (!content) throw new Error("Please enter note content.");
  if (title.length > 120) throw new Error("Title must be 120 characters or less.");
  if (content.length > 20000) throw new Error("Note content is too long.");
  if (category.length > 40) throw new Error("Category must be 40 characters or less.");
  return { title, content, category };
}

app.get("/api/notes", (req, res) => {
  const notes = readNotes().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(notes);
});

app.post("/api/notes", (req, res) => {
  try {
    const fields = cleanNote(req.body);
    const now = new Date().toISOString();
    const note = { id: require("crypto").randomUUID(), ...fields, createdAt: now, updatedAt: now };
    const notes = readNotes();
    notes.push(note);
    saveNotes(notes);
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/notes/:id", (req, res) => {
  try {
    const fields = cleanNote(req.body);
    const notes = readNotes();
    const index = notes.findIndex(note => note.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Note not found." });
    notes[index] = { ...notes[index], ...fields, updatedAt: new Date().toISOString() };
    saveNotes(notes);
    res.json(notes[index]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  const notes = readNotes();
  const filtered = notes.filter(note => note.id !== req.params.id);
  if (filtered.length === notes.length) return res.status(404).json({ error: "Note not found." });
  saveNotes(filtered);
  res.status(204).end();
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Notes Management Application running at http://localhost:${PORT}`);
});
