// postal-mime hands back a flattened model: html, text and a list of
// attachments. That is what you want to *read* a message, but it throws away
// the shape — which alternative won, what nests inside what, which part is
// actually oversized. This walks the raw source to recover the structure.
// It parses headers and boundaries only; part bodies are never decoded.

const HEADER_BODY_SPLIT = /\r?\n\r?\n/;

export function unfoldHeaders(block) {
  // RFC 5322 folding: a continuation line starts with whitespace.
  const lines = block.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim();
    else if (line.trim()) out.push(line);
  }
  return out.map((line) => {
    const at = line.indexOf(':');
    if (at === -1) return { key: line.trim(), value: '' };
    return { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
  });
}

function headerValue(headers, name) {
  const found = headers.find((h) => h.key.toLowerCase() === name.toLowerCase());
  return found ? found.value : '';
}

export function parseContentType(value) {
  if (!value) return { type: 'text/plain', params: {} };
  const [head, ...rest] = value.split(';');
  const params = {};
  for (const chunk of rest) {
    const at = chunk.indexOf('=');
    if (at === -1) continue;
    const key = chunk.slice(0, at).trim().toLowerCase();
    params[key] = chunk.slice(at + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return { type: head.trim().toLowerCase() || 'text/plain', params };
}

function splitOnBoundary(body, boundary) {
  // Boundaries are matched at line starts; the closing delimiter ends with --.
  const parts = [];
  const lines = body.split(/\r?\n/);
  const open = `--${boundary}`;
  const close = `--${boundary}--`;
  let current = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === close) break;
    if (trimmed === open) {
      if (current !== null) parts.push(current.join('\n'));
      current = [];
      continue;
    }
    if (current !== null) current.push(line);
  }
  if (current !== null) parts.push(current.join('\n'));
  return parts;
}

function walk(source, depth) {
  const split = source.match(HEADER_BODY_SPLIT);
  const at = split ? source.indexOf(split[0]) : -1;
  const headerBlock = at === -1 ? source : source.slice(0, at);
  const body = at === -1 ? '' : source.slice(at + split[0].length);

  const headers = unfoldHeaders(headerBlock);
  const contentType = parseContentType(headerValue(headers, 'Content-Type'));
  const disposition = parseContentType(headerValue(headers, 'Content-Disposition'));

  const node = {
    type: contentType.type,
    charset: contentType.params.charset ?? '',
    encoding: (headerValue(headers, 'Content-Transfer-Encoding') || '7bit').toLowerCase(),
    filename: disposition.params.filename ?? contentType.params.name ?? '',
    disposition: disposition.type === 'text/plain' ? '' : disposition.type,
    contentId: headerValue(headers, 'Content-ID').replace(/^<|>$/g, ''),
    size: body.length,
    depth,
    children: [],
  };

  const boundary = contentType.params.boundary;
  if (node.type.startsWith('multipart/') && boundary) {
    node.children = splitOnBoundary(body, boundary)
      .filter((part) => part.trim())
      .map((part) => walk(part, depth + 1));
  } else if (node.type === 'message/rfc822' && body.trim()) {
    node.children = [walk(body, depth + 1)];
  }

  return node;
}

export function buildMimeTree(rawText) {
  if (!rawText || !rawText.trim()) return null;
  return walk(rawText, 0);
}

export function flattenTree(node, out = []) {
  if (!node) return out;
  out.push(node);
  for (const child of node.children) flattenTree(child, out);
  return out;
}

export function countParts(node) {
  return flattenTree(node).length;
}
