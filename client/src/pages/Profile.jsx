import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaBookOpen, FaSignOutAlt, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router";
import FormField from "../components/FormField";
import ProgressBar from "../components/ProgressBar";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { fieldErrors } from "../lib/errors";
import { saveStudy } from "../lib/study";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function Profile() {
  const { user, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .history()
      .then((data) => active && setItems(data.items))
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, []);

  function open(item) {
    saveStudy({ subject: item.subject, concepts: item.concepts, completed: item.completed, historyId: item.id });
    navigate("/results");
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.subject}” from your saved subjects?`)) return;
    try {
      await api.deleteHistory(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
      toast.success("Deleted");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleLogout() {
    await logout();
    toast.success("Logged out");
    navigate("/");
  }

  async function handleDelete(event) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount(password);
      toast.success("Your account and data were deleted");
      navigate("/");
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  if (!user) return <Spinner fullScreen label="Loading your profile…" />;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <title>Profile · CogniFetch</title>

      <section className="card flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-2xl font-bold text-white uppercase"
          >
            {user.username.slice(0, 1)}
          </span>
          <div>
            <h1 className="font-sora text-2xl text-white">{user.username}</h1>
            <p className="text-slate-400">{user.email}</p>
            {user.createdAt && (
              <p className="text-xs text-slate-500">Member since {dateFormat.format(new Date(user.createdAt))}</p>
            )}
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          <FaSignOutAlt aria-hidden /> Log out
        </button>
      </section>

      <section>
        <h2 className="mb-4 font-sora text-2xl text-white">Saved subjects</h2>
        {loadError ? (
          <p role="alert" className="rounded-lg bg-red-500/10 p-4 text-red-300">
            {loadError}
          </p>
        ) : items === null ? (
          <Spinner label="Loading your subjects…" />
        ) : items.length === 0 ? (
          <p className="card p-6 text-slate-400">
            Nothing saved yet. After scanning a syllabus, press <strong>Save</strong> on the results page.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-sky-400">{item.subject}</p>
                  <p className="text-sm text-slate-400">
                    {(item.completed ?? []).length} of {item.concepts.length} topics done · updated{" "}
                    {dateFormat.format(new Date(item.updatedAt))}
                  </p>
                  <div className="mt-2 max-w-sm">
                    <ProgressBar
                      done={(item.completed ?? []).length}
                      total={item.concepts.length}
                      label={`${item.subject} progress`}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" onClick={() => open(item)}>
                    <FaBookOpen aria-hidden /> Open
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    onClick={() => remove(item)}
                    aria-label={`Delete ${item.subject}`}
                  >
                    <FaTrash aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChangePassword />

      <section className="rounded-2xl border border-red-500/50 bg-red-950/30 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-300">Danger zone</h2>
        <p className="mb-4 text-sm text-slate-300">
          Deleting your account permanently removes your profile and every saved subject.
        </p>
        {confirming ? (
          <form onSubmit={handleDelete} className="flex max-w-sm flex-col gap-3">
            <FormField
              label="Confirm with your password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={deleteError}
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-danger" disabled={!password || deleting}>
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        )}
      </section>
    </main>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const close = () => {
    setOpen(false);
    setForm({ currentPassword: "", newPassword: "", confirm: "" });
    setErrors({});
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirm) return setErrors({ confirm: "Passwords don't match" });
    setErrors({});
    setSaving(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      toast.success("Password changed. Other devices have been signed out.");
      close();
    } catch (err) {
      const byField = fieldErrors(err);
      setErrors(Object.keys(byField).length ? byField : { currentPassword: err.message });
    }
    setSaving(false);
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Password</h2>
      {open ? (
        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3" noValidate>
          <FormField
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update}
            error={errors.currentPassword}
            required
          />
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.newPassword}
            onChange={update}
            error={errors.newPassword}
            hint="At least 8 characters"
            required
          />
          <FormField
            label="Confirm new password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update}
            error={errors.confirm}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !form.currentPassword || !form.newPassword || !form.confirm}
            >
              {saving ? "Saving…" : "Change password"}
            </button>
            <button type="button" className="btn-ghost" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-400">Changing your password signs you out on every other device.</p>
          <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
            Change password
          </button>
        </>
      )}
    </section>
  );
}
