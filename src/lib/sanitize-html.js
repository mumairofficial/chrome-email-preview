import DOMPurify from 'dompurify';

// Email layout depends on inline and embedded CSS, so <style> and style="" stay.
// Everything that can execute, navigate, or reach the network on its own goes.
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'base', 'meta', 'link'];
const FORBID_ATTR = ['srcset', 'ping', 'formaction', 'target'];

// Relative URLs are meaningless in an email opened from a file, so only known
// schemes survive. Anchors are kept so in-message jump links still work.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|cid:|blob:|#|data:image\/)/i;

export function sanitizeHtml(html) {
  if (!html) return '';

  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP,
  });

  const doc = new DOMParser().parseFromString(clean, 'text/html');
  stripPinnedPositioning(doc);

  // <style> from <head> is hoisted into the fragment; browsers apply it wherever
  // it appears, and the fragment is what gets wrapped into the iframe srcdoc.
  return doc.head.innerHTML + doc.body.innerHTML;
}

function stripPinnedPositioning(doc) {
  for (const el of doc.querySelectorAll('[style]')) {
    const next = el.getAttribute('style').replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '');
    el.setAttribute('style', next);
  }
  for (const style of doc.querySelectorAll('style')) {
    style.textContent = style.textContent.replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '');
  }
}
