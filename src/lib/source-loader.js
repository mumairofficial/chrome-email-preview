export class SourceError extends Error {
  constructor(kind, message, options) {
    super(message, options);
    this.name = 'SourceError';
    this.kind = kind;
  }
}

export function isFileUrl(src) {
  return typeof src === 'string' && src.toLowerCase().startsWith('file:');
}

export async function loadFromUrl(src, { fetchImpl = fetch } = {}) {
  const file = isFileUrl(src);
  let response;

  try {
    response = await fetchImpl(src, { credentials: file ? 'omit' : 'include' });
  } catch (cause) {
    throw file
      ? new SourceError('file-access-denied', 'Chrome blocked access to this local file.', { cause })
      : new SourceError('fetch-failed', `Could not fetch ${src}`, { cause });
  }

  if (!response.ok) {
    throw new SourceError('fetch-failed', `Request failed with HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
}

export function loadFromFile(file) {
  return file.arrayBuffer();
}
