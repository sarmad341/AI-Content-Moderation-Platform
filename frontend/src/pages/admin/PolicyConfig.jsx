import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";
import Loading from "../../components/Loading";

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

  if (loading) return <Loading />;
  if (error) return <div className="alert alert--error">Error: {error}</div>;

  const isSuccessMessage =
    saveMessage && !saveMessage.startsWith("Error:");

  return (
    <div className="page">
      <div className="page-header">
        <h2>Policy Configuration</h2>
        <p>
          Active version {version}. Changes apply only to future submissions —
          existing verdicts are never retroactively altered.
        </p>
      </div>

      {categories.map((cat, index) => (
        <div
          key={cat.name}
          className={`card${!cat.enabled ? " card--disabled" : ""}`}
        >
          <div className="card__header">
            <span className="card__title">{cat.name}</span>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={cat.enabled}
                onChange={(e) =>
                  updateCategory(index, "enabled", e.target.checked)
                }
              />
              Enabled
            </label>
          </div>

          <div className="policy-controls">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`threshold-${index}`}>
                Threshold (%)
              </label>
              <input
                id={`threshold-${index}`}
                type="number"
                className="form-input"
                min="0"
                max="100"
                value={cat.threshold}
                onChange={(e) =>
                  updateCategory(index, "threshold", e.target.value)
                }
                disabled={!cat.enabled}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`enforcement-${index}`}>
                Enforcement
              </label>
              <select
                id={`enforcement-${index}`}
                className="form-select"
                value={cat.enforcement}
                onChange={(e) =>
                  updateCategory(index, "enforcement", e.target.value)
                }
                disabled={!cat.enabled}
              >
                <option value="Auto-Block">Auto-Block</option>
                <option value="Flag for Review">Flag for Review</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Policy"}
      </button>

      {saveMessage && (
        <div
          className={`alert${isSuccessMessage ? " alert--success" : " alert--error"}`}
          style={{ marginTop: "1rem" }}
        >
          {saveMessage}
        </div>
      )}
    </div>
  );
}

export default PolicyConfig;
