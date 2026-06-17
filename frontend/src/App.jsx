import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

function App() {
  // Grab the current user object
  const { user } = useUser();

  // Extract the role from publicMetadata, defaulting to 'user'
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

        {/* Visible ONLY when logged out */}
        <SignedOut>
          <div style={{ display: "flex", gap: "1rem" }}>
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </div>
        </SignedOut>

        {/* Visible ONLY when logged in */}
        <SignedIn>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span>
              Role: <strong>{role}</strong>
            </span>
            <UserButton />
          </div>
        </SignedIn>
      </header>

      <main style={{ marginTop: "2rem" }}>
        <SignedOut>
          <p>Please sign in to submit images for screening.</p>
        </SignedOut>

        <SignedIn>
          <h2>Welcome to your Dashboard</h2>
          <p>This area is visible to everyone who is logged in.</p>

          {/* Admin-only section */}
          {role === "admin" && (
            <div
              style={{
                marginTop: "2rem",
                padding: "1rem",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
              }}
            >
              <h3>Admin Controls</h3>
              <ul>
                <li>Appeals Queue</li>
                <li>Policy Configuration</li>
                <li>Analytics Dashboard</li>
              </ul>
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  );
}

export default App;
