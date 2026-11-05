import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FaExternalLinkAlt, FaPlay, FaPlus, FaSave, FaTrash, FaYoutube } from "react-icons/fa";
import { Link } from "react-router";
import Spinner from "../components/Spinner";
import videoPlay from "../assets/video-play.png";
import { api } from "../lib/api";
import { loadStudy, newConcept, persistConcepts } from "../lib/study";

export default function Results() {
  const [study] = useState(loadStudy);
  const [concepts, setConcepts] = useState(study?.concepts ?? []);
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState("");
  const [channel, setChannel] = useState("");
  const [popular, setPopular] = useState(false);
  const [active, setActive] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (study) persistConcepts(study.subject, concepts);
  }, [study, concepts]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? concepts.filter((c) => c.text.toLowerCase().includes(needle)) : concepts;
  }, [concepts, filter]);

  if (!study) {
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
    setLoading(true);
    setError("");
    try {
      const data = await api.searchVideo(
        { concept: concept.text, subject: study.subject, channel: channel.trim(), popular },
        { signal: abortRef.current.signal },
      );
      setResult(data);
      if (data.video.channelMatched === false) toast(`Couldn't find channel “${channel}”, showing best match.`);
    } catch (err) {
      if (err.name === "AbortError") return;
      setResult(null);
      setError(err.message);
    }
    setLoading(false);
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
      await api.saveHistory(study.subject, concepts.map((c) => c.text));
      toast.success(`Saved “${study.subject}” to your profile`);
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  }

  return (
    <main className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[22rem_1fr]">
      <title>{`${study.subject || "Results"} · CogniFetch`}</title>

      <aside className="flex flex-col gap-3 border-slate-800 p-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:border-r">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-slate-400 uppercase">Subject</p>
            <h1 className="truncate text-lg font-bold text-sky-300">{study.subject}</h1>
          </div>
          <button type="button" className="btn-primary px-4" onClick={save} disabled={saving || !concepts.length}>
            <FaSave aria-hidden /> {saving ? "Saving…" : "Save"}
          </button>
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
              className={`flex items-center justify-between gap-2 rounded-xl px-4 py-3 shadow-md shadow-black/30 ${
                active?.id === concept.id ? "bg-sky-400 text-slate-950" : "bg-sky-700/80 text-slate-50"
              }`}
            >
              <span className="min-w-0 break-words">{concept.text}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded-full bg-slate-950/30 p-2 hover:bg-slate-950/50"
                  onClick={() => play(concept)}
                  aria-label={`Play ${concept.text}`}
                >
                  <FaPlay aria-hidden />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-slate-950/30"
                  onClick={() => setConcepts(concepts.filter((c) => c.id !== concept.id))}
                  aria-label={`Remove ${concept.text}`}
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
          {loading ? (
            <Spinner label={`Finding the best video for “${active?.text}”…`} />
          ) : error ? (
            <p role="alert" className="mt-10 rounded-lg bg-red-500/10 p-4 text-red-300">
              {error}
            </p>
          ) : result ? (
            <article className="flex w-full max-w-4xl flex-col items-center gap-4">
              <h2 className="text-xl font-bold text-sky-400">{active?.text}</h2>
              <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-sky-800 shadow-lg shadow-black">
                <iframe
                  className="size-full"
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(result.video.videoId)}`}
                  title={result.video.title || active?.text}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              {result.video.title && (
                <p className="text-sm text-slate-400">
                  {decodeEntities(result.video.title)} · {decodeEntities(result.video.channelTitle)}
                </p>
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
