import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";
import { statusBadgeClass } from "../utils/status";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api";

function Home() {
  const { getToken } = useAuth();
  // Each queued item is { file, previewUrl } — previewUrl is a local
  // browser-memory object URL, used only for the thumbnail, never sent anywhere.
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFileChange(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    setQueuedFiles((prev) => {
      // Skip duplicates — same name + size already queued (simple, good-enough check).
      const existingKeys = new Set(prev.map((q) => `${q.file.name}-${q.file.size}`));
      const additions = newFiles
        .filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
        .map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }));

      return [...prev, ...additions];
    });

    setResult(null);
    setError(null);

    // Reset the input's value so selecting the SAME file again later
    // (after removing it) still fires onChange correctly.
    e.target.value = "";
  }

  function removeQueuedFile(index) {
    setQueuedFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl); // release browser memory
      return prev.filter((_, i) => i !== index);
    });
  }

  // Clean up any remaining preview URLs if the component unmounts mid-queue.
  useEffect(() => {
    return () => {
      queuedFiles.forEach((q) => URL.revokeObjectURL(q.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFiles(token) {
    const formData = new FormData();
    queuedFiles.forEach((q) => formData.append("images", q.file));

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.error?.message || "Upload failed");
    return json.data.imageUrls;
  }

  async function handleSubmit() {
    if (queuedFiles.length === 0) return;
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

      // Clean up preview URLs and clear the queue after a successful submit.
      queuedFiles.forEach((q) => URL.revokeObjectURL(q.previewUrl));
      setQueuedFiles([]);
    } catch (err) {
      setUploading(false);
      setScreening(false);
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Submit Images for Moderation</h2>
        <p>
          Select one or more images. Each is screened independently against
          active policy categories.
        </p>
      </div>

      <div className="file-upload">
        <label className="file-upload__label">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
          <span className="file-upload__icon" aria-hidden="true">
            📷
          </span>
          <span className="file-upload__text">
            <strong>Choose images</strong> or drag and drop here
          </span>
          <span className="file-upload__hint">
            PNG, JPG, GIF — up to 10 files, 10 MB each
          </span>
        </label>
      </div>

      {queuedFiles.length > 0 && (
        <div className="file-queue" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
          {queuedFiles.map((q, index) => (
            <div
              key={`${q.file.name}-${q.file.size}-${index}`}
              className="file-queue__item"
              style={{ position: "relative", width: "80px", height: "80px" }}
            >
              <img
                src={q.previewUrl}
                alt={q.file.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              />
              <button
                type="button"
                onClick={() => removeQueuedFile(index)}
                aria-label={`Remove ${q.file.name}`}
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: "none",
                  background: "#1a1a1a",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  lineHeight: "20px",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {queuedFiles.length > 0 && (
        <p className="file-count">{queuedFiles.length} file(s) queued</p>
      )}

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleSubmit}
        disabled={queuedFiles.length === 0 || uploading || screening}
      >
        {uploading
          ? "Uploading..."
          : screening
            ? "Screening with AI..."
            : "Submit for screening"}
      </button>

      {error && <div className="alert alert--error">Error: {error}</div>}

      {result && (
        <div className="page-section" style={{ marginTop: "2rem" }}>
          <h3>Screening Result</h3>
          <div className="meta-row">
            <span className="meta-row__label">Overall status</span>
            <span className={statusBadgeClass(result.submission.overallStatus)}>
              {result.submission.overallStatus}
            </span>
          </div>

          {result.verdicts.map((v) => (
            <div key={v._id} className="card">
              <div className="card__header" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <img
                  src={v.imageUrl}
                  alt="Submitted"
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                  }}
                />
                <span className="card__title">Image verdict</span>
                <span className={statusBadgeClass(v.outcome)}>{v.outcome}</span>
              </div>
              <ul className="verdict-list">
                {v.categoryResults.map((c) => (
                  <li key={c.category} className="verdict-item">
                    <span className="verdict-item__category">
                      {c.category} — {c.confidence}% confidence
                      {c.triggered && (
                        <span className="verdict-item__triggered">
                          TRIGGERED
                        </span>
                      )}
                    </span>
                    <p className="verdict-item__reasoning">{c.reasoning}</p>
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