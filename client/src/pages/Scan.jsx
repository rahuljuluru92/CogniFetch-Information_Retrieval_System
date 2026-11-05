import { useEffect, useRef, useState } from "react";
import { FaCamera, FaExclamationTriangle, FaFileImage, FaKeyboard, FaPlusCircle, FaRegPaperPlane, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { ACCEPTED_IMAGE_TYPES as ACCEPTED, MAX_IMAGES, MAX_UPLOAD_MB as MAX_MB, validateImage } from "../lib/image";
import { saveStudy } from "../lib/study";

const MAX_TEXT = 20000;
let nextPageId = 1;

export default function Scan() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const pagesRef = useRef([]);
  const [mode, setMode] = useState("photo"); // photo | text
  const [subject, setSubject] = useState("");
  const [pages, setPages] = useState([]); // { id, file, url }
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Release previews and cancel any in-flight request when leaving the page.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [],
  );

  function addFiles(fileList) {
    const files = [...(fileList ?? [])];
    if (files.length === 0) return;
    const room = MAX_IMAGES - pages.length;
    const problems = [];
    const accepted = [];
    for (const file of files) {
      const problem = validateImage(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else if (accepted.length < room) accepted.push(file);
      else problems.push(`Only ${MAX_IMAGES} pages per scan; skipped ${file.name}.`);
    }
    setError(problems.join(" "));
    setPages([...pages, ...accepted.map((file) => ({ id: nextPageId++, file, url: URL.createObjectURL(file) }))]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePage(id) {
    const page = pages.find((p) => p.id === id);
    if (page) URL.revokeObjectURL(page.url);
    setPages(pages.filter((p) => p.id !== id));
  }

  const ready = subject.trim() && (mode === "photo" ? pages.length > 0 : text.trim().length >= 3);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!subject.trim()) return setError("Enter the subject so we can find the right videos.");
    if (!ready) return setError(mode === "photo" ? "Add at least one image." : "Paste some syllabus text first.");

    setError("");
    setLoading(true);
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    try {
      const { concepts } =
        mode === "photo" ? await api.extract(pages.map((p) => p.file), { signal }) : await api.extractText(text, { signal });
      saveStudy({ subject, concepts });
      navigate("/results");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Spinner
        fullScreen
        label={
          mode === "photo" && pages.length > 1
            ? `Reading ${pages.length} pages and finding topics…`
            : "Reading your syllabus and finding topics…"
        }
      />
    );
  }

  const tab = (value, Icon, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setError("");
      }}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold transition ${
        mode === value ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-white"
      }`}
    >
      <Icon aria-hidden /> {label}
    </button>
  );

  return (
    <main className="flex min-h-[calc(100vh-9rem)] flex-col items-center gap-6 px-4 py-10">
      <title>Scan · CogniFetch</title>
      <h1 className="font-sora text-3xl text-sky-300">Scan your syllabus</h1>

      <form onSubmit={handleSubmit} className="card flex w-full max-w-lg flex-col gap-5 p-6" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subject" className="text-sm font-semibold text-slate-300">
            Subject
          </label>
          <input
            id="subject"
            className="input"
            placeholder="e.g. Operating Systems"
            maxLength={100}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div role="tablist" aria-label="Input method" className="flex gap-1 rounded-full bg-slate-900 p-1">
          {tab("photo", FaCamera, "Photo")}
          {tab("text", FaKeyboard, "Paste text")}
        </div>

        {mode === "photo" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-4 border-dashed p-6 text-center transition ${
              dragging ? "border-sky-400 bg-sky-500/10" : "border-sky-700"
            }`}
          >
            {pages.length > 0 ? (
              <ol className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {pages.map((page, index) => (
                  <li key={page.id} className="relative overflow-hidden rounded-lg border border-slate-600">
                    <img src={page.url} alt={`Page ${index + 1}`} className="h-28 w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-slate-950/80 px-1.5 text-xs">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePage(page.id)}
                      aria-label={`Remove page ${index + 1}`}
                      className="absolute top-1 right-1 rounded-full bg-slate-950/80 p-1.5 hover:bg-red-600"
                    >
                      <FaTimes aria-hidden className="text-xs" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <FaFileImage aria-hidden className="text-5xl text-sky-700" />
            )}
            {pages.length < MAX_IMAGES && (
              <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()}>
                <FaPlusCircle aria-hidden /> {pages.length ? "Add page" : "Choose images"}
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED.join(",")}
              className="sr-only"
              aria-label="Syllabus images"
              onChange={(e) => addFiles(e.target.files)}
            />
            <p className="text-sm text-slate-400">
              or drag and drop · up to {MAX_IMAGES} pages · JPEG, PNG, WebP · max {MAX_MB} MB each
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="syllabus-text" className="text-sm font-semibold text-slate-300">
              Syllabus text
            </label>
            <textarea
              id="syllabus-text"
              className="input min-h-56 resize-y font-mono text-sm"
              placeholder={"Unit I – Process Management: Process concepts, Threads, Scheduling algorithms…"}
              maxLength={MAX_TEXT}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-right text-xs text-slate-500">
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary py-3 text-lg" disabled={!ready}>
          Find topics <FaRegPaperPlane aria-hidden />
        </button>
      </form>

      <aside className="card w-full max-w-lg p-5 text-sm text-indigo-200">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <FaExclamationTriangle aria-hidden /> Tips for the best results
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Crop to just the syllabus content; add each page of a long syllabus separately.</li>
          <li>Use good lighting and keep the page flat.</li>
          <li>Have the syllabus as a PDF or web page? Copy the text and use “Paste text”.</li>
        </ul>
      </aside>
    </main>
  );
}
