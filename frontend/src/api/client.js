const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api";

/**
 * Wrapper around fetch that automatically attaches the Clerk session token
 * and handles the standard { success, data } / { success, error } envelope
 * used across the entire backend (per PDR section 5.6).
 *
 * @param {string} path - e.g. "/submissions"
 * @param {object} options - fetch options, plus a `getToken` function from Clerk's useAuth()
 */
async function apiRequest(path, { method = "GET", body, getToken } = {}) {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!json.success) {
    const err = new Error(json.error?.message || "Request failed");
    err.code = json.error?.code;
    throw err;
  }

  return json.data;
}

export default apiRequest;
