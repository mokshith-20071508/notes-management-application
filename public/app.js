const grid = document.getElementById("notesGrid");
const emptyState = document.getElementById("emptyState");
const dialog = document.getElementById("noteDialog");
const form = document.getElementById("noteForm");
const titleInput = document.getElementById("noteTitle");
const categorySelect = document.getElementById("noteCategory");
const customCategory = document.getElementById("customCategory");
const contentInput = document.getElementById("noteContent");
const errorBox = document.getElementById("formError");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const visibleCount = document.getElementById("visibleCount");
const allCount = document.getElementById("allCount");
const toast = document.getElementById("toast");

let notes = [];
let activeCategory = "All";
let editingId = null;
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    let message = "Something went wrong.";
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function categoryClass(category) {
  const key = category.toLowerCase();
  return ["personal", "study", "work", "ideas"].includes(key) ? key : "other";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function filteredNotes() {
  const query = searchInput.value.trim().toLowerCase();
  let result = notes.filter(note => {
    const matchesCategory = activeCategory === "All" || note.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = !query || `${note.title} ${note.content} ${note.category}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  if (sortSelect.value === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortSelect.value === "created") result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return result;
}

function render() {
  const shown = filteredNotes();
  grid.innerHTML = shown.map(note => `
    <article class="note-card">
      <div class="note-card-top">
        <span class="category-pill ${categoryClass(note.category)}">${escapeHTML(note.category)}</span>
        <div class="card-actions">
          <button type="button" title="Edit note" aria-label="Edit ${escapeHTML(note.title)}" data-edit="${note.id}">✎</button>
          <button type="button" title="Delete note" aria-label="Delete ${escapeHTML(note.title)}" data-delete="${note.id}">⌫</button>
        </div>
      </div>
      <h3>${escapeHTML(note.title)}</h3>
      <p class="note-preview">${escapeHTML(note.content)}</p>
      <div class="note-card-footer"><span>Updated ${formatDate(note.updatedAt)}</span><span>↗</span></div>
    </article>
  `).join("");
  visibleCount.textContent = shown.length;
  allCount.textContent = notes.length;
  emptyState.hidden = shown.length !== 0;
  grid.hidden = shown.length === 0;
  document.getElementById("emptyTitle").textContent = notes.length === 0 ? "Your notes start here" : "No notes found";
  document.getElementById("emptyText").textContent = notes.length === 0
    ? "Capture a thought, a reminder, or something you want to remember."
    : "Try another search or choose a different category.";
  document.getElementById("emptyNewBtn").style.display = notes.length === 0 ? "" : "none";
  pageTitle.textContent = activeCategory === "All" ? "All notes" : activeCategory;
  pageSubtitle.textContent = activeCategory === "All"
    ? "Keep your thoughts clear and organized."
    : `Your ${activeCategory.toLowerCase()} notes, all in one place.`;
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.category.toLowerCase() === activeCategory.toLowerCase());
  });
}

async function loadNotes() {
  try {
    notes = await api("/api/notes");
    render();
  } catch (error) {
    notify("Could not load notes. Is the server running?");
  }
}

function openEditor(note = null) {
  editingId = note ? note.id : null;
  document.getElementById("dialogTitle").textContent = note ? "Edit note" : "Create a note";
  document.getElementById("saveBtn").textContent = note ? "Save changes" : "Save note";
  titleInput.value = note?.title || "";
  contentInput.value = note?.content || "";
  const existingOption = [...categorySelect.options].find(option => option.value.toLowerCase() === (note?.category || "Personal").toLowerCase());
  if (existingOption) {
    categorySelect.value = existingOption.value;
    customCategory.value = "";
  } else {
    categorySelect.value = "Personal";
    customCategory.value = note?.category || "";
  }
  errorBox.textContent = "";
  dialog.showModal();
  setTimeout(() => titleInput.focus(), 50);
}

function closeEditor() {
  dialog.close();
}

document.getElementById("newNoteBtn").addEventListener("click", () => openEditor());
document.getElementById("topNewBtn").addEventListener("click", () => openEditor());
document.getElementById("emptyNewBtn").addEventListener("click", () => openEditor());
document.getElementById("closeDialog").addEventListener("click", closeEditor);
document.getElementById("cancelDialog").addEventListener("click", closeEditor);
dialog.addEventListener("click", event => { if (event.target === dialog) closeEditor(); });

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    render();
  });
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);

grid.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const note = notes.find(item => item.id === editButton.dataset.edit);
    if (note) openEditor(note);
  }
  if (deleteButton) {
    const note = notes.find(item => item.id === deleteButton.dataset.delete);
    if (!note || !confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      notes = notes.filter(item => item.id !== note.id);
      render();
      notify("Note deleted.");
    } catch (error) { notify(error.message); }
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const category = customCategory.value.trim() || categorySelect.value;
  const payload = { title: titleInput.value, content: contentInput.value, category };
  errorBox.textContent = "";
  try {
    const saved = editingId
      ? await api(`/api/notes/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/notes", { method: "POST", body: JSON.stringify(payload) });
    if (editingId) notes = notes.map(note => note.id === editingId ? saved : note);
    else notes.unshift(saved);
    closeEditor();
    render();
    notify(editingId ? "Changes saved." : "Note created.");
  } catch (error) {
    errorBox.textContent = error.message;
  }
});

// Keyboard shortcut: Ctrl/Cmd + K focuses search; Escape closes the editor naturally.
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

loadNotes();
