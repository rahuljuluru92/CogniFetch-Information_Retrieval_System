import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { fieldErrors } from "../lib/errors";

export default function Register() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = location.state?.from ?? "/scan";

  if (status === "authenticated" && !submitting) return <Navigate to={redirectTo} replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setErrors({ confirm: "Passwords don't match" });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password });
      toast.success("Account created. Let's get studying!");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const byField = fieldErrors(err);
      setErrors(Object.keys(byField).length ? byField : { form: err.message });
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-hero flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-10">
      <title>Create account · CogniFetch</title>
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-5 p-8" noValidate>
        <h1 className="gradient-text text-center font-michroma text-3xl font-bold">Register</h1>
        <FormField
          label="Username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          value={form.username}
          onChange={update}
          error={errors.username}
          hint="3–32 characters: letters, numbers, . _ -"
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update}
          error={errors.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={update}
          error={errors.password}
          hint="At least 8 characters"
        />
        <FormField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={update}
          error={errors.confirm}
        />
        {errors.form && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {errors.form}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitting || !form.username || !form.email || !form.password || !form.confirm}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" state={location.state} className="font-semibold text-sky-400 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
