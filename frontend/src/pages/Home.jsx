// frontend/src/pages/Home.jsx
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api";

function Home() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFileChange(e) {
    setFiles(Array.from(e.target.files));
    setResult(null);
    setError(null);
  }

  async function uploadFiles(token) {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData, // browser sets multipart Content-Type automatically
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.error?.message || "Upload failed");
    return json.data.imageUrls;
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setError(null);
    setResult(null);

    try {
      const token = await getToken();

      setUploading(true);
      const imageUrls = await uploadFiles(token);
      setUploading(false);

      setScreening(true);
      const data = await apiRequest("/submissions", {
        method: "POST",
        body: { imageUrls },
        getToken,
      });
      setScreening(false);

      setResult(data);
      setFiles([]);
    } catch (err) {
      setUploading(false);
      setScreening(false);
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Submit Images for Moderation</h2>
      <p>
        Select one or more images. Each is screened independently against active
        policy categories.
      </p>

      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />
      {files.length > 0 && <p>{files.length} file(s) selected.</p>}

      <button
        onClick={handleSubmit}
        disabled={files.length === 0 || uploading || screening}
        style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
      >
        {uploading
          ? "Uploading..."
          : screening
            ? "Screening with AI..."
            : "Submit"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>Error: {error}</p>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Result</h3>
          <p>
            Overall status:{" "}
            <strong
              style={{
                color:
                  result.submission.overallStatus === "Approved"
                    ? "green"
                    : result.submission.overallStatus === "Flagged"
                      ? "orange"
                      : "red",
              }}
            >
              {result.submission.overallStatus}
            </strong>
          </p>

          {result.verdicts.map((v) => (
            <div
              key={v._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <p>
                <strong>Image outcome:</strong> {v.outcome}
              </p>
              <ul>
                {v.categoryResults.map((c) => (
                  <li key={c.category}>
                    {c.category} — confidence: {c.confidence}%
                    {c.triggered ? " (TRIGGERED)" : ""}
                    <br />
                    <em>{c.reasoning}</em>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
