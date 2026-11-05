import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-9rem)] place-items-center px-6 py-24 text-center">
      <title>Page not found · CogniFetch</title>
      <div>
        <p className="font-semibold text-sky-500">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-sky-200 sm:text-5xl">Page not found</h1>
        <p className="mt-6 text-slate-400">Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
        <Link to="/" className="btn-primary mt-10">
          Go back home
        </Link>
      </div>
    </main>
  );
}
