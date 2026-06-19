import { Routes, Route, NavLink, Link } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

import AdminRoute from "./components/AdminRoute";
import Home from "./pages/Home";
import SubmissionHistory from "./pages/SubmissionHistory";
import AppealTracker from "./pages/AppealTracker";
import AppealsQueue from "./pages/admin/AppealsQueue";
import PolicyConfig from "./pages/admin/PolicyConfig";
import Analytics from "./pages/admin/Analytics";
import FlaggedQueue from "./pages/admin/FlaggedQueue";

function App() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "user";
  const isAdmin = role === "admin";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-brand">
            <span className="app-brand__logo">CL</span>
            <span className="app-brand__name">ClearLens</span>
          </Link>

          <SignedOut>
            <div className="btn-group">
              <SignInButton mode="modal">
                <button type="button" className="btn btn--secondary">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="btn btn--primary">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="app-header__actions">
              <span
                className={`role-badge${isAdmin ? " role-badge--admin" : ""}`}
              >
                {role}
              </span>
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </header>

      <SignedIn>
        <nav className="app-nav">
          <div className="app-nav__inner">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `app-nav__link${isActive ? " app-nav__link--active" : ""}`
              }
            >
              Submit
            </NavLink>
            <NavLink
              to="/submissions"
              className={({ isActive }) =>
                `app-nav__link${isActive ? " app-nav__link--active" : ""}`
              }
            >
              My Submissions
            </NavLink>
            <NavLink
              to="/appeals"
              className={({ isActive }) =>
                `app-nav__link${isActive ? " app-nav__link--active" : ""}`
              }
            >
              My Appeals
            </NavLink>
            {isAdmin && (
              <>
                <span className="app-nav__divider" aria-hidden="true" />
                <NavLink
                  to="/admin/queue"
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? " app-nav__link--active" : ""}`
                  }
                >
                  Appeals Queue
                </NavLink>
                <NavLink
                  to="/admin/flagged"
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? " app-nav__link--active" : ""}`
                  }
                >
                  Flagged Submissions
                </NavLink>
                <NavLink
                  to="/admin/policy"
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? " app-nav__link--active" : ""}`
                  }
                >
                  Policy Config
                </NavLink>
                <NavLink
                  to="/admin/analytics"
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? " app-nav__link--active" : ""}`
                  }
                >
                  Analytics
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </SignedIn>

      <main
        className={`app-main${!user ? " app-main--centered" : ""}`}
      >
        <SignedOut>
          <div className="empty-state">
            <p>Sign in to submit images for AI-powered content screening.</p>
          </div>
        </SignedOut>

        <SignedIn>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/submissions" element={<SubmissionHistory />} />
            <Route path="/appeals" element={<AppealTracker />} />
            <Route
              path="/admin/queue"
              element={
                <AdminRoute>
                  <AppealsQueue />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/flagged"
              element={
                <AdminRoute>
                  <FlaggedQueue />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/policy"
              element={
                <AdminRoute>
                  <PolicyConfig />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <Analytics />
                </AdminRoute>
              }
            />
          </Routes>
        </SignedIn>
      </main>
    </div>
  );
}

export default App;