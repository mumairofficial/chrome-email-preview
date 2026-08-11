import PostalMime from 'postal-mime';

export class EmailParseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'EmailParseError';
  }
}

export function normalizeCid(cid) {
  if (!cid) return '';
  return String(cid).replace(/^</, '').replace(/>$/, '');
}

function toAttachment(raw) {
  const content = raw.content instanceof ArrayBuffer
    ? raw.content
    : new Uint8Array(raw.content ?? []).buffer;
  return {
    filename: raw.filename || '(unnamed)',
    mimeType: raw.mimeType || 'application/octet-stream',
    disposition: raw.disposition || 'attachment',
    related: Boolean(raw.related) || raw.disposition === 'inline',
    contentId: normalizeCid(raw.contentId),
    content,
    size: content.byteLength,
  };
}

export async function parseEmail(buffer) {
  let raw;
  try {
    raw = await new PostalMime().parse(buffer);
  } catch (cause) {
    throw new EmailParseError('Could not parse this file as an email message.', { cause });
  }

  const model = {
    headers: (raw.headers ?? []).map((h) => ({ key: h.key, value: h.value })),
    from: raw.from ?? null,
    to: raw.to ?? [],
    cc: raw.cc ?? [],
    bcc: raw.bcc ?? [],
    replyTo: raw.replyTo ?? [],
    subject: raw.subject ?? '',
    messageId: raw.messageId ?? '',
    inReplyTo: raw.inReplyTo ?? '',
    references: raw.references ?? '',
    date: raw.date ?? '',
    html: raw.html || null,
    text: raw.text || null,
    attachments: (raw.attachments ?? []).map(toAttachment),
  };

  // postal-mime is lenient enough to turn an arbitrary line of text into a
  // single valueless header, so a message counts as readable only if it has a
  // body or at least one header that actually carries a value.
  const hasRealHeader = model.headers.some((h) => h.value?.trim());
  if (!hasRealHeader && !model.html && !model.text) {
    throw new EmailParseError('Could not parse this file as an email message.');
  }
  return model;
}
