import { useEffect, useState } from "react";
import { FaCheckCircle, FaRedo, FaTimesCircle } from "react-icons/fa";
import { api } from "../lib/api";
import Spinner from "./Spinner";

const LETTERS = ["A", "B", "C", "D"];

/** A short multiple-choice quiz for one concept, generated on the server. */
export default function Quiz({ concept, subject, onClose }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    api
      .quiz({ concept, subject, count: 5 }, { signal: controller.signal })
      .then((data) => setQuestions(data.questions))
      .catch((err) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, [concept, subject]);

  if (error) {
    return (
      <section className="card w-full p-5 text-left">
        <p role="alert" className="text-red-300">
          {error}
        </p>
        <button type="button" className="btn-ghost mt-4" onClick={onClose}>
          Back to video
        </button>
      </section>
    );
  }
  if (!questions) return <Spinner label={`Writing questions about “${concept}”…`} />;

  const answered = Object.keys(answers).length;
  const score = questions.filter((q, i) => answers[i] === q.answerIndex).length;
  const finished = answered === questions.length;

  return (
    <section className="w-full text-left" aria-label={`Quiz on ${concept}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-sky-400">Quiz: {concept}</h2>
        <div className="flex gap-2">
          {answered > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setAnswers({})}>
              <FaRedo aria-hidden /> Retry
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Back to video
          </button>
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const revealed = chosen !== undefined;
          return (
            <li key={qi} className="card p-5">
              <p className="mb-3 font-semibold text-white">
                {qi + 1}. {q.question}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((option, oi) => {
                  const correct = oi === q.answerIndex;
                  const style = !revealed
                    ? "border-slate-600 hover:border-sky-400"
                    : correct
                      ? "border-emerald-400 bg-emerald-500/15"
                      : oi === chosen
                        ? "border-red-400 bg-red-500/15"
                        : "border-slate-700 opacity-60";
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={revealed}
                      aria-pressed={chosen === oi}
                      onClick={() => setAnswers({ ...answers, [qi]: oi })}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${style}`}
                    >
                      <span className="font-bold text-sky-300">{LETTERS[oi]}</span>
                      <span className="flex-1">{option}</span>
                      {revealed && correct && <FaCheckCircle aria-label="Correct answer" className="mt-1 text-emerald-400" />}
                      {revealed && !correct && oi === chosen && (
                        <FaTimesCircle aria-label="Your answer" className="mt-1 text-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              {revealed && q.explanation && <p className="mt-3 text-sm text-slate-300">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>

      {finished && (
        <p role="status" className="card mt-4 p-5 text-center text-lg">
          You scored <strong className="text-sky-300">{score}</strong> out of {questions.length}
          {score === questions.length ? " 🎉 Perfect!" : score >= questions.length / 2 ? ". Nice work!" : ". Rewatch the video and try again."}
        </p>
      )}
    </section>
  );
}
