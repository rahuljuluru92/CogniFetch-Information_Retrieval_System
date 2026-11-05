// The current study list survives page refreshes (per tab) but never leaves the browser
// unless the user saves it to their profile.
const KEY = "cognifetch.study";

let nextId = 1;
export const newConcept = (text, done = false) => ({ id: nextId++, text, done });

function write(study) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        subject: study.subject,
        historyId: study.historyId ?? null,
        concepts: study.concepts.map((c) => c.text),
        completed: study.concepts.filter((c) => c.done).map((c) => c.text),
      }),
    );
  } catch {
    /* storage may be unavailable (private mode); the in-memory copy still works */
  }
}

function build({ subject, concepts, completed = [], historyId = null }) {
  const doneKeys = new Set(completed.map((c) => c.toLowerCase()));
  return {
    subject: subject.trim(),
    historyId,
    concepts: concepts.map((text) => newConcept(text, doneKeys.has(text.toLowerCase()))),
  };
}

/** Starts a new study session from plain strings (a fresh scan or a saved subject). */
export function saveStudy(input) {
  const study = build(input);
  write(study);
  return study;
}

export function loadStudy() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY));
    if (raw && typeof raw.subject === "string" && Array.isArray(raw.concepts)) {
      return build({
        subject: raw.subject,
        historyId: typeof raw.historyId === "string" ? raw.historyId : null,
        concepts: raw.concepts.filter((c) => typeof c === "string"),
        completed: Array.isArray(raw.completed) ? raw.completed.filter((c) => typeof c === "string") : [],
      });
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return null;
}

/** Persists the in-memory study (with ids/done flags) after edits. */
export const persistStudy = write;

export function clearStudy() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Markdown export of the study list, with progress checkboxes. */
export function toMarkdown(study) {
  const done = study.concepts.filter((c) => c.done).length;
  const lines = [
    `# ${study.subject || "Study list"}`,
    "",
    `Progress: ${done}/${study.concepts.length} topics done`,
    "",
    ...study.concepts.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`),
    "",
    `_Exported from CogniFetch on ${new Date().toLocaleDateString()}_`,
    "",
  ];
  return lines.join("\n");
}

export function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "study-list"
  );
}
