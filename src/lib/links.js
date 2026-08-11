// Phishing rarely hides in the href alone — it hides in the gap between what a
// link says and where it goes. This extracts that gap so the reader can see it
// without hovering every link.

const DOMAINISH = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$)/i;

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function registrable(host) {
  // Good enough to compare "mail.example.com" with "example.com" without
  // shipping a public-suffix list.
  const labels = host.split('.');
  return labels.slice(-2).join('.');
}

export function isPunycode(host) {
  return host.split('.').some((label) => label.startsWith('xn--'));
}

// A link whose text is itself a domain is claiming to go there. If it doesn't,
// that is the classic disguised link.
export function textClaimsDifferentHost(text, host) {
  const claimed = DOMAINISH.exec((text ?? '').trim());
  if (!claimed || !host) return false;
  const claimedHost = claimed[1].toLowerCase();
  return registrable(claimedHost) !== registrable(host);
}

export function extractLinks(html) {
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = [];

  for (const anchor of doc.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href').trim();
    if (/^(?:mailto|tel):/i.test(href)) continue;
    if (href.startsWith('#') || href.startsWith('cid:')) continue;

    const host = hostOf(href);
    const text = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim();

    links.push({
      href,
      text,
      host,
      punycode: isPunycode(host),
      mismatch: textClaimsDifferentHost(text, host),
      insecure: /^http:\/\//i.test(href),
    });
  }

  return links;
}

export function summarizeLinks(links) {
  return {
    total: links.length,
    suspicious: links.filter((l) => l.mismatch || l.punycode).length,
    hosts: [...new Set(links.map((l) => l.host).filter(Boolean))].sort(),
  };
}
