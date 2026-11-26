const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "notes.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const GUEST_USER_ID = "shared-workspace";

app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));

function readNotes() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function readUsers() {
  const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  if (!Array.isArray(data)) throw new Error("User data must be an array.");
  return data;
}

function saveNotes(notes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in to continue." });
  next();
}

function safeUser(user) {
  return { id: user.id, username: user.username };
}

function startSession(req, user, res) {
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ error: "Could not start your session." });
    req.session.userId = user.id;
    req.session.save(saveError => {
      if (saveError) return res.status(500).json({ error: "Could not save your session." });
      res.json({ user: safeUser(user) });
    });
  });
}

function startGuestSession(req, username, res) {
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ error: "Could not start your session." });
    const user = { id: GUEST_USER_ID, username: username || "Guest" };
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.save(saveError => {
      if (saveError) return res.status(500).json({ error: "Could not save your session." });
      res.json({ user });
    });
  });
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

app.post("/api/auth/register", async (req, res) => {
  const username = String((req.body || {}).username || "").trim().toLowerCase();
  const password = String((req.body || {}).password || "");
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–32 characters using letters, numbers, underscores, or hyphens." });
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Password must be at least 8 characters and no more than 72 bytes." });
  }
  try {
    const users = readUsers();
    if (users.some(user => user.username === username)) {
      return res.status(409).json({ error: "That username is already registered." });
    }
    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: await bcrypt.hash(password, 12)
    };
    users.push(user);
    saveUsers(users);
    startSession(req, user, res);
  } catch (error) {
    console.error("Could not register user:", error);
    res.status(500).json({ error: "Could not create your account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const enteredUsername = String((req.body || {}).username || "").trim().slice(0, 32);
  const username = enteredUsername.toLowerCase();
  const password = String((req.body || {}).password || "");
  try {
    const user = readUsers().find(item => item.username === username);
    if (user && await bcrypt.compare(password, user.passwordHash)) return startSession(req, user, res);
    startGuestSession(req, enteredUsername || "Guest", res);
  } catch (error) {
    console.error("Could not log in user:", error);
    res.status(500).json({ error: "Could not log in." });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  if (req.session.userId === GUEST_USER_ID) {
    return res.json({ user: { id: GUEST_USER_ID, username: req.session.username || "Guest" } });
  }
  const user = readUsers().find(item => item.id === req.session.userId);
  if (!user) {
    return req.session.destroy(error => {
      if (error) return res.status(500).json({ error: "Could not clear the invalid session." });
      res.json({ user: null });
    });
  }
  res.json({ user: safeUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ error: "Could not log out." });
    res.clearCookie("connect.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.status(204).end();
  });
});

app.get("/api/notes", requireAuth, (req, res) => {
  const notes = readNotes()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(notes);
});

app.post("/api/notes", requireAuth, (req, res) => {
  try {
    const fields = cleanNote(req.body);
    const now = new Date().toISOString();
    const note = { id: crypto.randomUUID(), userId: req.session.userId, ...fields, createdAt: now, updatedAt: now };
    const notes = readNotes();
    notes.push(note);
    saveNotes(notes);
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/notes/:id", requireAuth, (req, res) => {
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

app.delete("/api/notes/:id", requireAuth, (req, res) => {
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
