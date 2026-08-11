const defaultCreateUrl = (blob) => URL.createObjectURL(blob);

export function buildCidMap(attachments = [], createUrl = defaultCreateUrl) {
  const map = new Map();
  for (const att of attachments) {
    if (!att.contentId) continue;
    const blob = new Blob([att.content], { type: att.mimeType });
    map.set(att.contentId, createUrl(blob));
  }
  return map;
}

export function inlineCid(html, cidMap) {
  if (!html) return '';
  if (!cidMap || cidMap.size === 0) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of doc.querySelectorAll('[src^="cid:" i]')) {
    const id = el.getAttribute('src').slice(4).replace(/^</, '').replace(/>$/, '');
    const url = cidMap.get(id);
    if (url) el.setAttribute('src', url);
  }
  return doc.head.innerHTML + doc.body.innerHTML;
}
