const BASE = "/api";

function getToken() {
  return localStorage.getItem("stocksense_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("stocksense_token", token);
  else localStorage.removeItem("stocksense_token");
}

export function getUser() {
  const raw = localStorage.getItem("stocksense_user");
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user) {
  if (user) localStorage.setItem("stocksense_user", JSON.stringify(user));
  else localStorage.removeItem("stocksense_user");
}

// Central request helper. Throws an Error with a .details field (from Zod)
// when the API responds with a validation failure, so forms can show
// field-level messages instead of one generic alert.
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.details = data?.details;
    err.status = res.status;
    throw err;
  }
  return data;
}
