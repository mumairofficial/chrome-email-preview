import { formatBytes } from '../format.js';
import { previewTypeFor } from '../../lib/previewable.js';
import { assessAttachment, sha256 } from '../../lib/attachment-risk.js';

const defaultCreateUrl = (blob) => URL.createObjectURL(blob);

function isDisplayed(att) {
  // Inline images already appear in the body; showing them again is noise.
  return !(att.related && att.contentId);
}

function meta(att) {
  const span = document.createElement('span');
  span.className = 'attachment__meta';
  span.textContent = `${att.mimeType} · ${formatBytes(att.size)}`;
  return span;
}

// Chrome downloads a blob it cannot type instead of previewing it, so an
// attachment whose declared type differs from its preview type needs a second
// blob carrying the real one. Matching types reuse the download URL.
function previewLink(att, previewType, downloadUrl, createUrl) {
  const url = att.mimeType === previewType
    ? downloadUrl
    : createUrl(new Blob([att.content], { type: previewType }));

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Preview';
  return link;
}

function riskBadge(risk) {
  const badge = document.createElement('span');
  badge.className = `attachment__risk attachment__risk--${risk.level}`;
  badge.textContent = risk.level === 'danger' ? 'Unsafe' : 'Caution';
  badge.title = risk.reasons.map((r) => r.text).join('. ');
  return badge;
}

function hashButton(att) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'attachment__hash';
  button.textContent = 'SHA-256';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const digest = await sha256(att.content);
    const code = document.createElement('code');
    code.className = 'attachment__digest';
    code.textContent = digest;
    code.title = 'Click to select';
    button.replaceWith(code);
  });
  return button;
}

export function renderAttachments(attachments = [], { onOpenNested, createUrl = defaultCreateUrl } = {}) {
  const shown = attachments.filter(isDisplayed);
  if (shown.length === 0) return null;

  const section = document.createElement('section');
  section.className = 'rail__section attachments';

  const heading = document.createElement('h2');
  heading.className = 'rail__title';
  heading.textContent = `Attachments (${shown.length})`;
  section.append(heading);

  const list = document.createElement('ul');

  for (const att of shown) {
    const item = document.createElement('li');
    item.className = 'attachment';

    const name = document.createElement('span');
    name.className = 'attachment__name';
    name.textContent = att.filename;
    item.append(name);

    const risk = assessAttachment(att);
    if (risk.level !== 'ok') {
      item.append(riskBadge(risk));
      item.classList.add(`attachment--${risk.level}`);
    }

    item.append(meta(att));

    if (att.mimeType === 'message/rfc822' && onOpenNested) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      button.addEventListener('click', () => onOpenNested(att));
      item.append(button);
    } else {
      const downloadUrl = createUrl(new Blob([att.content], { type: att.mimeType }));

      const previewType = previewTypeFor(att);
      if (previewType) item.append(previewLink(att, previewType, downloadUrl, createUrl));

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = att.filename;
      link.textContent = 'Download';
      item.append(link);
    }

    item.append(hashButton(att));
    list.append(item);
  }

  section.append(list);
  return section;
}
