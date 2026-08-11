function originPatternFor(src) {
  const { protocol, host } = new URL(src);
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  return `${protocol}//${host}/*`;
}

export async function hasHostPermission(src) {
  const origins = originPatternFor(src);
  if (!origins) return true;
  return chrome.permissions.contains({ origins: [origins] });
}

// Must be called from a user gesture, or Chrome rejects it.
export async function requestHostPermission(src) {
  const origins = originPatternFor(src);
  if (!origins) return true;
  return chrome.permissions.request({ origins: [origins] });
}
