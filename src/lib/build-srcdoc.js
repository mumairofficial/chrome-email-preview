// WHY THIS EXISTS: allow-same-origin is deliberately absent. Without it the frame
// is an opaque origin that cannot read the viewer's DOM, storage, or cookies.
// allow-scripts is safe only because of that omission, and exists solely for the
// nonce'd find responder below.
export const IFRAME_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

export const FIND_MESSAGE_TYPE = 'eml-preview-find';
export const FIND_RESULT_MESSAGE_TYPE = 'eml-preview-find-result';

const BASE_STYLES = `
  html, body { margin: 0; padding: 16px; background: #fff; color: #111; }
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  img[data-blocked-src], img[data-blocked-background] {
    min-width: 12px; min-height: 12px;
    border: 1px dashed #bbb; border-radius: 2px; background: #f6f6f6;
  }
`;

// The body lives in an opaque origin, so the viewer cannot search it from the
// outside. Find is relayed in over postMessage and answered here.
function findResponder() {
  return `
    (function () {
      addEventListener('message', function (event) {
        var data = event.data || {};
        if (data.type !== ${JSON.stringify(FIND_MESSAGE_TYPE)}) return;
        var found = false;
        if (data.query) {
          if (data.fromStart) { try { getSelection().removeAllRanges(); } catch (e) {} }
          found = window.find(data.query, false, Boolean(data.backwards), true, false, false, false);
        }
        parent.postMessage(
          { type: ${JSON.stringify(FIND_RESULT_MESSAGE_TYPE)}, found: found },
          '*'
        );
      });
    })();
  `;
}

export function buildSrcdoc(bodyHtml, { nonce, allowRemoteImages = false } = {}) {
  if (!nonce) throw new Error('buildSrcdoc requires a nonce');

  const imgSrc = allowRemoteImages ? 'data: blob: https: http:' : 'data: blob:';
  const csp = [
    "default-src 'none'",
    `img-src ${imgSrc}`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
  ].join('; ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<style>${BASE_STYLES}</style>
</head>
<body>
${bodyHtml}
<script nonce="${nonce}">${findResponder()}</script>
</body>
</html>`;
}
