export function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);

  if (typeof window === "undefined" || headers.has("Authorization")) {
    return headers;
  }

  const token = window.localStorage.getItem("docmanager_token");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: authHeaders(init.headers),
  });
}
