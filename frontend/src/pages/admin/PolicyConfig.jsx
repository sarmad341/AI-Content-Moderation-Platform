import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";

function PolicyConfig() {
  const { getToken } = useAuth();

  const [categories, setCategories] = useState([]);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  async function loadActivePolicy() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/policy/active", { getToken });
      setVersion(data.version);
      // Deep copy so we can edit locally without mutating the fetched object directly.
      setCategories(data.categories.map((c) => ({ ...c })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivePolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCategory(index, field, value) {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      // Strip Mongoose-specific fields, send only what the backend expects.
      const payload = categories.map((c) => ({
        name: c.name,
        enabled: c.enabled,
        threshold: Number(c.threshold),
        enforcement: c.enforcement,
      }));

      const updated = await apiRequest("/policy", {
        method: "PUT",
        body: { categories: payload },
        getToken,
      });

      setVersion(updated.version);
      setSaveMessage(
        `Saved as version ${updated.version}. This applies to future submissions only.`,
      );
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>Policy Configuration (Active Version: {version})</h2>
      <p style={{ color: "#666" }}>
        Changes apply only to submissions made after saving. Existing verdicts
        are never retroactively altered.
      </p>

      {categories.map((cat, index) => (
        <div
          key={cat.name}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
            opacity: cat.enabled ? 1 : 0.5,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>{cat.name}</strong>
            <label>
              <input
                type="checkbox"
                checked={cat.enabled}
                onChange={(e) =>
                  updateCategory(index, "enabled", e.target.checked)
                }
              />{" "}
              Enabled
            </label>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem" }}>
            <label>
              Threshold (%):{" "}
              <input
                type="number"
                min="0"
                max="100"
                value={cat.threshold}
                onChange={(e) =>
                  updateCategory(index, "threshold", e.target.value)
                }
                disabled={!cat.enabled}
                style={{ width: "70px" }}
              />
            </label>

            <label>
              Enforcement:{" "}
              <select
                value={cat.enforcement}
                onChange={(e) =>
                  updateCategory(index, "enforcement", e.target.value)
                }
                disabled={!cat.enabled}
              >
                <option value="Auto-Block">Auto-Block</option>
                <option value="Flag for Review">Flag for Review</option>
              </select>
            </label>
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ padding: "0.5rem 1.5rem" }}
      >
        {saving ? "Saving..." : "Save Policy"}
      </button>

      {saveMessage && <p style={{ marginTop: "1rem" }}>{saveMessage}</p>}
    </div>
  );
}

export default PolicyConfig;
