import { sanitizeHtml } from '../lib/sanitize-html.js';
import { blockRemote } from '../lib/block-remote.js';
import { buildCidMap, inlineCid } from '../lib/inline-cid.js';
import { buildSrcdoc } from '../lib/build-srcdoc.js';

const EMPTY_BODY = '<p><em>This message has no readable body.</em></p>';

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function textToHtml(text) {
  return `<pre style="white-space: pre-wrap; font: inherit; margin: 0">${escapeHtml(text)}</pre>`;
}

export function renderBody(model, { allowRemoteImages = false, nonce, createUrl } = {}) {
  let fragment;

  if (model.html) {
    const cidMap = buildCidMap(model.attachments, createUrl);
    fragment = sanitizeHtml(inlineCid(model.html, cidMap));
  } else if (model.text) {
    fragment = textToHtml(model.text);
  } else {
    fragment = EMPTY_BODY;
  }

  let blockedCount = 0;
  if (!allowRemoteImages) {
    const blocked = blockRemote(fragment);
    fragment = blocked.html;
    blockedCount = blocked.blockedCount;
  }

  return { srcdoc: buildSrcdoc(fragment, { nonce, allowRemoteImages }), blockedCount };
}
