import { formatBytes } from '../format.js';

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

export function renderAttachments(attachments = [], { onOpenNested, createUrl = defaultCreateUrl } = {}) {
  const shown = attachments.filter(isDisplayed);
  if (shown.length === 0) return null;

  const section = document.createElement('section');
  section.className = 'attachments';

  const heading = document.createElement('h2');
  heading.textContent = `Attachments (${shown.length})`;
  section.append(heading);

  const list = document.createElement('ul');

  for (const att of shown) {
    const item = document.createElement('li');
    item.className = 'attachment';

    const name = document.createElement('span');
    name.className = 'attachment__name';
    name.textContent = att.filename;
    item.append(name, meta(att));

    if (att.mimeType === 'message/rfc822' && onOpenNested) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      button.addEventListener('click', () => onOpenNested(att));
      item.append(button);
    } else {
      const link = document.createElement('a');
      link.href = createUrl(new Blob([att.content], { type: att.mimeType }));
      link.download = att.filename;
      link.textContent = 'Download';
      item.append(link);
    }

    list.append(item);
  }

  section.append(list);
  return section;
}
