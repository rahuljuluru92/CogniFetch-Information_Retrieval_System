import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import Footer from "./components/Footer";
import Header from "./components/Header";
import RequireAuth from "./components/RequireAuth";
import Spinner from "./components/Spinner";
import Home from "./pages/Home";

const Instructions = lazy(() => import("./pages/Instructions"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Scan = lazy(() => import("./pages/Scan"));
const Results = lazy(() => import("./pages/Results"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-white focus:p-2 focus:text-black">
        Skip to content
      </a>
      <Header />
      <div id="content" className="flex flex-1 flex-col">
        <Suspense fallback={<Spinner fullScreen />}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="instructions" element={<Instructions />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route element={<RequireAuth />}>
              <Route path="scan" element={<Scan />} />
              <Route path="results" element={<Results />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
      <Footer />
    </div>
  );
}
