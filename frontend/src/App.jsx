// frontend/src/App.jsx
import { Routes, Route, Link } from "react-router-dom";
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

function App() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "user";

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ccc",
          paddingBottom: "1rem",
        }}
      >
        <h1>ClearLens</h1>

        <SignedOut>
          <div style={{ display: "flex", gap: "1rem" }}>
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </div>
        </SignedOut>

        <SignedIn>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span>
              Role: <strong>{role}</strong>
            </span>
            <UserButton />
          </div>
        </SignedIn>
      </header>

      <SignedIn>
        <nav style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
          <Link to="/">Home</Link>
          <Link to="/submissions">My Submissions</Link>
          <Link to="/appeals">My Appeals</Link>
          {role === "admin" && (
            <>
              <Link to="/admin/queue">Appeals Queue</Link>
              <Link to="/admin/policy">Policy Config</Link>
              <Link to="/admin/analytics">Analytics</Link>
            </>
          )}
        </nav>
      </SignedIn>

      <main style={{ marginTop: "1rem" }}>
        <SignedOut>
          <p>Please sign in to submit images for screening.</p>
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
