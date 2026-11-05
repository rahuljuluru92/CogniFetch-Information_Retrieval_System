import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FaCheck,
  FaDownload,
  FaExternalLinkAlt,
  FaPlay,
  FaPlus,
  FaQuestionCircle,
  FaSave,
  FaTrash,
  FaYoutube,
} from "react-icons/fa";
import { Link } from "react-router";
import ProgressBar from "../components/ProgressBar";
import Quiz from "../components/Quiz";
import Spinner from "../components/Spinner";
import videoPlay from "../assets/video-play.png";
import { api } from "../lib/api";
import { downloadText } from "../lib/download";
import { loadStudy, newConcept, persistStudy, slugify, toMarkdown } from "../lib/study";

export default function Results() {
  const [initial] = useState(loadStudy);
  const [subject] = useState(initial?.subject ?? "");
  const [historyId, setHistoryId] = useState(initial?.historyId ?? null);
  const [concepts, setConcepts] = useState(initial?.concepts ?? []);
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState("");
  const [channel, setChannel] = useState("");
  const [popular, setPopular] = useState(false);
  const [active, setActive] = useState(null);
  const [result, setResult] = useState(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [view, setView] = useState("video"); // video | quiz
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (initial) persistStudy({ subject, historyId, concepts });
  }, [initial, subject, historyId, concepts]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? concepts.filter((c) => c.text.toLowerCase().includes(needle)) : concepts;
  }, [concepts, filter]);
  const doneCount = concepts.filter((c) => c.done).length;

  if (!initial) {
    return (
      <main className="grid min-h-[calc(100vh-9rem)] place-items-center p-6 text-center">
        <title>Results · CogniFetch</title>
        <div className="card max-w-md p-8">
          <h1 className="mb-3 text-2xl font-bold text-sky-300">Nothing to show yet</h1>
          <p className="mb-6 text-slate-300">Scan a syllabus or open a saved subject from your profile.</p>
          <div className="flex justify-center gap-3">
            <Link to="/scan" className="btn-primary">
              Scan a syllabus
            </Link>
            <Link to="/profile" className="btn-ghost">
              My subjects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  async function play(concept) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setActive(concept);
    setView("video");
    setVideoIndex(0);
    setLoading(true);
    setError("");
    try {
      const data = await api.searchVideo(
        { concept: concept.text, subject, channel: channel.trim(), popular },
        { signal: abortRef.current.signal },
      );
      setResult({ ...data, videos: data.videos?.length ? data.videos : [data.video] });
      if (data.channelMatched === false) toast(`Couldn't find channel “${channel}”, showing best matches.`);
    } catch (err) {
      if (err.name === "AbortError") return;
      setResult(null);
      setError(err.message);
    }
    setLoading(false);
  }

  function quiz(concept) {
    abortRef.current?.abort();
    setLoading(false);
    setError("");
    if (active?.id !== concept.id) setResult(null);
    setActive(concept);
    setView("quiz");
  }

  async function toggleDone(concept) {
    const done = !concept.done;
    const apply = (value) =>
      setConcepts((list) => list.map((c) => (c.id === concept.id ? { ...c, done: value } : c)));
    apply(done);
    if (!historyId) return; // not saved yet: progress is kept locally and sent on Save
    try {
      await api.setProgress(historyId, concept.text, done);
    } catch (err) {
      apply(!done);
      toast.error(err.status === 404 ? "Save the list first to sync progress." : err.message);
    }
  }

  function addConcept(event) {
    event.preventDefault();
    const text = extra.trim();
    if (!text) return;
    if (concepts.some((c) => c.text.toLowerCase() === text.toLowerCase())) {
      toast.error("That topic is already in the list");
      return;
    }
    setConcepts([newConcept(text), ...concepts]);
    setExtra("");
  }

  async function save() {
    setSaving(true);
    try {
      const { item } = await api.saveHistory(
        subject,
        concepts.map((c) => c.text),
        concepts.filter((c) => c.done).map((c) => c.text),
      );
      setHistoryId(item.id);
      toast.success(`Saved “${subject}” to your profile`);
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  }

  function exportMarkdown() {
    downloadText(`${slugify(subject)}.md`, toMarkdown({ subject, concepts }));
  }

  const video = result?.videos?.[videoIndex];
  const activeConcept = active ? concepts.find((c) => c.id === active.id) : null;

  return (
    <main className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[23rem_1fr]">
      <title>{`${subject || "Results"} · CogniFetch`}</title>

      <aside className="flex flex-col gap-3 border-slate-800 p-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:border-r">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-slate-400 uppercase">Subject</p>
            <h1 className="truncate text-lg font-bold text-sky-300">{subject}</h1>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="btn-ghost px-3"
              onClick={exportMarkdown}
              aria-label="Export as Markdown"
              title="Export as Markdown"
            >
              <FaDownload aria-hidden />
            </button>
            <button type="button" className="btn-primary px-4" onClick={save} disabled={saving || !concepts.length}>
              <FaSave aria-hidden /> {saving ? "Saving…" : historyId ? "Update" : "Save"}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-slate-400">
            {doneCount} of {concepts.length} topics done
            {!historyId && doneCount > 0 && " · save to keep your progress"}
          </p>
          <ProgressBar done={doneCount} total={concepts.length} />
        </div>

        <input
          className="input"
          type="search"
          placeholder="Filter topics"
          aria-label="Filter topics"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <form onSubmit={addConcept} className="flex gap-2">
          <input
            className="input"
            placeholder="Add a topic"
            aria-label="Add a topic"
            maxLength={200}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          <button type="submit" className="btn-ghost px-3" aria-label="Add topic">
            <FaPlus aria-hidden />
          </button>
        </form>

        <p className="text-xs text-slate-500">
          {visible.length} of {concepts.length} topics
        </p>
        <ul className="flex flex-col gap-2">
          {visible.map((concept) => (
            <li
              key={concept.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-3 shadow-md shadow-black/30 ${
                active?.id === concept.id ? "bg-sky-400 text-slate-950" : "bg-sky-700/80 text-slate-50"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={concept.done}
                  aria-label={`Mark ${concept.text} as ${concept.done ? "not done" : "done"}`}
                  onClick={() => toggleDone(concept)}
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition ${
                    concept.done ? "border-emerald-300 bg-emerald-400 text-slate-950" : "border-current/60"
                  }`}
                >
                  {concept.done && <FaCheck aria-hidden className="text-xs" />}
                </button>
                <span className={`min-w-0 break-words ${concept.done ? "line-through opacity-70" : ""}`}>
                  {concept.text}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  className="rounded-full bg-slate-950/30 p-2 hover:bg-slate-950/50"
                  onClick={() => play(concept)}
                  aria-label={`Play ${concept.text}`}
                  title="Watch"
                >
                  <FaPlay aria-hidden />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-slate-950/30"
                  onClick={() => quiz(concept)}
                  aria-label={`Quiz me on ${concept.text}`}
                  title="Quiz me"
                >
                  <FaQuestionCircle aria-hidden />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-slate-950/30"
                  onClick={() => setConcepts(concepts.filter((c) => c.id !== concept.id))}
                  aria-label={`Remove ${concept.text}`}
                  title="Remove"
                >
                  <FaTrash aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col">
        <div className="m-2 flex flex-wrap items-center justify-evenly gap-3 rounded-xl bg-black/60 px-4 py-3">
          <FaYoutube aria-hidden className="text-4xl text-red-500" />
          <input
            className="input max-w-80"
            placeholder="Preferred channel (optional)"
            aria-label="Preferred YouTube channel"
            maxLength={100}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sky-300">
            <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} />
            Most watched
          </label>
        </div>

        <div className="flex flex-1 flex-col items-center px-4 pb-10 text-center" aria-live="polite">
          {view === "quiz" && active ? (
            <div className="w-full max-w-3xl">
              <Quiz
                key={active.id}
                concept={active.text}
                subject={subject}
                onClose={() => (result ? setView("video") : play(active))}
              />
            </div>
          ) : loading ? (
            <Spinner label={`Finding the best videos for “${active?.text}”…`} />
          ) : error ? (
            <p role="alert" className="mt-10 rounded-lg bg-red-500/10 p-4 text-red-300">
              {error}
            </p>
          ) : video ? (
            <article className="flex w-full max-w-4xl flex-col items-center gap-4">
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-sky-400">{active?.text}</h2>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => quiz(active)}>
                    <FaQuestionCircle aria-hidden /> Quiz me
                  </button>
                  {activeConcept && !activeConcept.done && (
                    <button type="button" className="btn-ghost" onClick={() => toggleDone(activeConcept)}>
                      <FaCheck aria-hidden /> Mark done
                    </button>
                  )}
                </div>
              </div>
              <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-sky-800 shadow-lg shadow-black">
                <iframe
                  key={video.videoId}
                  className="size-full"
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}`}
                  title={decodeEntities(video.title) || active?.text}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              {video.title && (
                <p className="text-sm text-slate-400">
                  {decodeEntities(video.title)} · {decodeEntities(video.channelTitle)}
                </p>
              )}

              {result.videos.length > 1 && (
                <section className="w-full text-left" aria-label="Other videos">
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">Not quite right? Try another video</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {result.videos.map((option, index) => (
                      <button
                        key={option.videoId}
                        type="button"
                        onClick={() => setVideoIndex(index)}
                        aria-pressed={index === videoIndex}
                        aria-label={`Watch ${decodeEntities(option.title) || `video ${index + 1}`}`}
                        className={`overflow-hidden rounded-lg border-2 text-left transition ${
                          index === videoIndex ? "border-sky-400" : "border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        {option.thumbnail && (
                          <img src={option.thumbnail} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                        )}
                        <span className="line-clamp-2 p-2 text-xs text-slate-300">{decodeEntities(option.title)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {result.article && (
                <section className="card w-full p-5 text-left">
                  <h3 className="mb-2 text-lg font-semibold text-sky-300">{result.article.title}</h3>
                  <p className="leading-relaxed text-slate-200">{result.article.extract}</p>
                  <a
                    href={result.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sky-400 hover:underline"
                  >
                    Read more on Wikipedia <FaExternalLinkAlt aria-hidden className="text-xs" />
                  </a>
                </section>
              )}
            </article>
          ) : (
            <div className="mt-10 flex flex-col items-center">
              <h2 className="text-3xl text-indigo-300">Pick a topic to start</h2>
              <p className="mt-2 text-slate-400">Press ▶ to watch, or ? to quiz yourself.</p>
              <img src={videoPlay} alt="" className="size-72" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// YouTube returns HTML-escaped titles (e.g. &#39;). Decode without ever injecting HTML.
function decodeEntities(text = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
