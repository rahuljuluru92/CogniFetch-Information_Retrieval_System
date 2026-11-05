import { FaUserCircle } from "react-icons/fa";
import { Link, NavLink } from "react-router";
import logo from "../assets/mlogo.png";
import { useAuth } from "../context/AuthContext";

const linkClass = ({ isActive }) =>
  `rounded-full px-3 py-1.5 font-semibold transition ${
    isActive ? "bg-white/15 text-white" : "text-sky-100/80 hover:text-white"
  }`;

export default function Header() {
  const { user, status } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-sky-500 shadow-lg shadow-black/20">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-3" aria-label="CogniFetch home">
          <img src={logo} alt="" className="size-10 rounded-full" />
          <span className="hidden font-michroma text-lg text-white sm:inline">CogniFetch</span>
        </Link>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm sm:text-base">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/scan" className={linkClass}>
            Scan
          </NavLink>
          <NavLink to="/instructions" className={linkClass}>
            How it works
          </NavLink>
          {status === "authenticated" ? (
            <NavLink to="/profile" className={linkClass} aria-label="Your profile">
              <span className="flex items-center gap-2">
                <FaUserCircle aria-hidden className="text-lg" />
                <span className="hidden max-w-32 truncate md:inline">{user.username}</span>
              </span>
            </NavLink>
          ) : status === "anonymous" ? (
            <NavLink to="/login" className={linkClass}>
              Log in
            </NavLink>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
