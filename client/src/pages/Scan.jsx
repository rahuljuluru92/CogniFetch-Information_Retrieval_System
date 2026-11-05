import { useEffect, useRef, useState } from "react";
import { FaExclamationTriangle, FaFileImage, FaPlusCircle, FaRegPaperPlane, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { ACCEPTED_IMAGE_TYPES as ACCEPTED, MAX_UPLOAD_MB as MAX_MB, validateImage } from "../lib/image";
import { saveStudy } from "../lib/study";

export default function Scan() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const previewRef = useRef(null);

  // Release the preview's object URL and cancel any in-flight upload when leaving the page.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function showPreview(nextFile) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = nextFile ? URL.createObjectURL(nextFile) : null;
    setPreview(previewRef.current);
  }

  function pick(candidate) {
    const problem = validateImage(candidate);
    setError(problem ?? "");
    setFile(problem ? null : candidate);
    showPreview(problem ? null : candidate);
  }

  function clearFile() {
    setFile(null);
    showPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!subject.trim()) return setError("Enter the subject so we can find the right videos.");
    const problem = validateImage(file);
    if (problem) return setError(problem);

    setError("");
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const { concepts } = await api.extract(file, { signal: abortRef.current.signal });
      if (concepts.length === 0) {
        setError("We couldn't find any topics in that image. Try a clearer or tighter crop.");
        setLoading(false);
        return;
      }
      saveStudy({ subject, concepts });
      navigate("/results");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) return <Spinner fullScreen label="Reading your syllabus and finding topics…" />;

  return (
    <main className="flex min-h-[calc(100vh-9rem)] flex-col items-center gap-6 px-4 py-10">
      <title>Scan · CogniFetch</title>
      <h1 className="font-sora text-3xl text-sky-300">Scan your syllabus</h1>

      <form onSubmit={handleSubmit} className="card flex w-full max-w-md flex-col gap-5 p-6" noValidate>
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

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-3 rounded-2xl border-4 border-dashed p-6 text-center transition ${
            dragging ? "border-sky-400 bg-sky-500/10" : "border-sky-700"
          }`}
        >
          {preview ? (
            <img src={preview} alt="Selected syllabus" className="max-h-56 rounded-lg object-contain" />
          ) : (
            <FaFileImage aria-hidden className="text-5xl text-sky-700" />
          )}
          <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()}>
            <FaPlusCircle aria-hidden /> {file ? "Choose another" : "Choose image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            aria-label="Syllabus image"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <p className="text-sm text-slate-400">or drag and drop · JPEG, PNG, WebP · max {MAX_MB} MB</p>
          {file && (
            <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-sky-500/90 px-4 py-2 text-slate-950">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={clearFile} aria-label="Remove image" className="shrink-0">
                <FaTrash aria-hidden />
              </button>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary py-3 text-lg" disabled={!file || !subject.trim()}>
          Go <FaRegPaperPlane aria-hidden />
        </button>
      </form>

      <aside className="card w-full max-w-md p-5 text-sm text-indigo-200">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <FaExclamationTriangle aria-hidden /> Tips for the best results
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Crop to just the syllabus content.</li>
          <li>Use good lighting and keep the page flat.</li>
          <li>Images must be {MAX_MB} MB or smaller.</li>
        </ul>
      </aside>
    </main>
  );
}
