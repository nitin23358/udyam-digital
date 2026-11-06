async function req(method, url, body, isForm) {
  const res = await fetch('/api' + url, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.data = data;
    throw err;
  }
  return data;
}
export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b || {}),
  put: (u, b) => req('PUT', u, b),
  form: (u, fd) => req('POST', u, fd, true),
};
