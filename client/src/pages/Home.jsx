import { Link } from "react-router";

export default function Home() {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-9rem)] items-center justify-center overflow-hidden bg-hero px-4">
      <title>CogniFetch — study smarter from your syllabus</title>
      <div aria-hidden className="absolute -top-10 -left-10 -z-10 size-80 rounded-full bg-indigo-900/60 blur-3xl" />
      <div aria-hidden className="absolute top-28 right-10 -z-10 size-80 rounded-full bg-blue-900/60 blur-3xl" />

      <div className="max-w-3xl text-center">
        <h1 className="gradient-text mb-8 font-michroma text-4xl font-bold lg:text-7xl">COGNI FETCH</h1>
        <p className="text-xl font-bold text-sky-400 lg:text-3xl">Running short on exam prep time?</p>
        <p className="mt-1 text-xl font-bold text-sky-400 lg:text-3xl">
          Don&apos;t worry, <span className="text-3xl font-extrabold text-fuchsia-100 md:text-5xl">we&apos;ve got you.</span>
        </p>
        <p className="mx-auto mt-4 mb-10 max-w-xl text-sm text-slate-300 lg:text-lg">
          Snap a photo of your syllabus. CogniFetch reads it, pulls out every topic and finds a focused video and
          a short explainer for each one.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/scan" className="btn bg-white px-8 py-3 text-slate-900 hover:bg-sky-400">
            Let&apos;s do this!
          </Link>
          <Link to="/instructions" className="btn bg-white/10 px-8 py-3 text-white ring-1 ring-white/30 hover:bg-white/20">
            How it works
          </Link>
        </div>
      </div>
    </main>
  );
}
