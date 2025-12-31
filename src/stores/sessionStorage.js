export function readSessionJSON(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeSessionJSON(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {

  }
}

export function removeSession(key) {
  sessionStorage.removeItem(key);
}
