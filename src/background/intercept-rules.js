const EML_PATH = /\.eml$/i;
const INTERCEPTABLE_SCHEMES = new Set(['file:', 'http:', 'https:']);

export function isEmlUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!INTERCEPTABLE_SCHEMES.has(parsed.protocol)) return false;

  let path = parsed.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Leave the raw pathname in place if it is not valid percent-encoding.
  }
  return EML_PATH.test(path);
}

export function shouldInterceptDownload(item) {
  if (!item) return false;
  const url = item.finalUrl || item.url || '';

  // Downloads we ourselves initiate (the "Download original" button) use blob: URLs.
  // Intercepting those would trap the user in a loop.
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;

  if (item.mime === 'message/rfc822') return true;
  if (isEmlUrl(url)) return true;
  return EML_PATH.test(item.filename || '');
}

export function viewerUrlFor(src, viewerPath) {
  return `${viewerPath}?src=${encodeURIComponent(src)}`;
}
