const REMOTE_URL = /^(?:https?:)?\/\//i;
const REMOTE_CSS_URL = /url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]*\1\s*\)/gi;

export function blockRemote(html) {
  if (!html) return { html: '', blockedCount: 0 };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  let blockedCount = 0;

  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (!REMOTE_URL.test(src)) continue;
    img.setAttribute('data-blocked-src', src);
    img.removeAttribute('src');
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[background]')) {
    const src = el.getAttribute('background');
    if (!REMOTE_URL.test(src)) continue;
    el.setAttribute('data-blocked-background', src);
    el.removeAttribute('background');
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[style]')) {
    const before = el.getAttribute('style');
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    el.setAttribute('style', after);
    blockedCount += countMatches(before);
  }

  for (const style of doc.querySelectorAll('style')) {
    const before = style.textContent;
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    style.textContent = after;
    blockedCount += countMatches(before);
  }

  return { html: doc.head.innerHTML + doc.body.innerHTML, blockedCount };
}

function countMatches(text) {
  return (text.match(REMOTE_CSS_URL) ?? []).length;
}
