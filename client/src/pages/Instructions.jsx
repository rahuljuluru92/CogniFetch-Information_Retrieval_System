import { Link } from "react-router";
import fishing from "../assets/fishing.png";

const STEPS = [
  ["Create an account", "Register with a username, email and password. Your saved subjects stay private to you."],
  ["Scan your syllabus", "Enter the subject, then upload up to 5 photos of your syllabus or simply paste its text."],
  ["Review the topics", "We read the text and list every topic we found. Remove noise or add anything we missed."],
  ["Watch and read", "Press Play on a topic for a focused video plus a short Wikipedia summary."],
  ["Tune the search", "Prefer a channel? Type its name. Tick “Most watched”, or pick one of the alternative videos."],
  ["Test yourself", "Press “Quiz me” for a quick AI-generated multiple-choice quiz on any topic."],
  ["Track your progress", "Tick topics off as you finish them, save the list and watch your progress bar fill up."],
  ["Take it with you", "Export any list as a Markdown checklist for your notes app."],
];

export default function Instructions() {
  return (
    <main className="bg-hero flex min-h-[calc(100vh-9rem)] items-center justify-evenly gap-8 px-4 py-10">
      <title>How it works · CogniFetch</title>
      <img src={fishing} alt="" className="hidden w-2/5 max-w-xl xl:block" />
      <section className="w-full max-w-xl">
        <h1 className="mb-6 text-center font-sora text-3xl text-sky-300">How it works</h1>
        <ol className="card divide-y divide-slate-700/60">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="flex gap-4 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-500 font-bold text-slate-950">
                {index + 1}
              </span>
              <div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="text-sm text-slate-300">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link to="/scan" className="btn-primary">
            Start scanning
          </Link>
        </div>
      </section>
    </main>
  );
}
