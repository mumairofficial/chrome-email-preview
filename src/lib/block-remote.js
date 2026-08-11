const REMOTE_URL = /^(?:https?:)?\/\//i;
const REMOTE_CSS_URL = /url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]*\1\s*\)/gi;

// A pixel too small to see is not decoration; it is a read receipt.
function isTrackingPixel(img) {
  const w = Number(img.getAttribute('width'));
  const h = Number(img.getAttribute('height'));
  if (w && h && w <= 3 && h <= 3) return true;
  const style = img.getAttribute('style') ?? '';
  return /(?:^|[;\s])(?:width|height)\s*:\s*[0-3](?:px)?\s*(?:;|$)/i.test(style);
}

export function blockRemote(html) {
  if (!html) return { html: '', blockedCount: 0, blocked: [] };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocked = [];
  let blockedCount = 0;

  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (!REMOTE_URL.test(src)) continue;
    img.setAttribute('data-blocked-src', src);
    img.removeAttribute('src');
    blocked.push({ url: src, kind: 'image', tracker: isTrackingPixel(img) });
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[background]')) {
    const src = el.getAttribute('background');
    if (!REMOTE_URL.test(src)) continue;
    el.setAttribute('data-blocked-background', src);
    el.removeAttribute('background');
    blocked.push({ url: src, kind: 'background', tracker: false });
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[style]')) {
    const before = el.getAttribute('style');
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    el.setAttribute('style', after);
    for (const url of matchedUrls(before)) blocked.push({ url, kind: 'css', tracker: false });
    blockedCount += countMatches(before);
  }

  for (const style of doc.querySelectorAll('style')) {
    const before = style.textContent;
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    style.textContent = after;
    for (const url of matchedUrls(before)) blocked.push({ url, kind: 'css', tracker: false });
    blockedCount += countMatches(before);
  }

  return { html: doc.head.innerHTML + doc.body.innerHTML, blockedCount, blocked };
}

function countMatches(text) {
  return (text.match(REMOTE_CSS_URL) ?? []).length;
}

function matchedUrls(text) {
  return (text.match(REMOTE_CSS_URL) ?? []).map((decl) =>
    decl.replace(/^url\(\s*['"]?/i, '').replace(/['"]?\s*\)$/, '')
  );
}
