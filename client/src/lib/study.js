// The current study list survives page refreshes (per tab) but never leaves the browser.
const KEY = "cognifetch.study";

let nextId = 1;
const withIds = (concepts) => concepts.map((text) => ({ id: nextId++, text }));

export function saveStudy({ subject, concepts }) {
  const study = { subject: subject.trim(), concepts: withIds(concepts) };
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ subject: study.subject, concepts }));
  } catch {
    /* storage may be unavailable (private mode); the in-memory copy still works */
  }
  return study;
}

export function loadStudy() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY));
    if (raw && typeof raw.subject === "string" && Array.isArray(raw.concepts)) {
      return { subject: raw.subject, concepts: withIds(raw.concepts.filter((c) => typeof c === "string")) };
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return null;
}

export function persistConcepts(subject, concepts) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ subject, concepts: concepts.map((c) => c.text) }));
  } catch {
    /* ignore */
  }
}

export function clearStudy() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const newConcept = (text) => ({ id: nextId++, text });
