import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = location.state?.from ?? "/scan";

  if (status === "authenticated" && !submitting) return <Navigate to={redirectTo} replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      toast.success("Welcome back!");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-hero flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-10">
      <title>Log in · CogniFetch</title>
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-5 p-8" noValidate>
        <h1 className="gradient-text text-center font-michroma text-3xl font-bold">Log in</h1>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={submitting || !form.email || !form.password}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-400">
          New here?{" "}
          <Link to="/register" state={location.state} className="font-semibold text-sky-400 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
