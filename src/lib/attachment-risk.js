// Two cheap checks that catch most hostile attachments: an extension that can
// execute, and bytes that disagree with the declared type.

const EXECUTABLE = new Set([
  'exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'msi', 'msp', 'hta', 'cpl', 'jar', 'reg', 'lnk', 'ps1', 'dll', 'scf', 'app',
]);

// Archives hide the above from scanners; worth naming without crying wolf.
const ARCHIVE = new Set(['zip', 'rar', '7z', 'iso', 'img', 'cab', 'ace']);

const SIGNATURES = [
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export function extensionOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename ?? '');
  return match ? match[1].toLowerCase() : '';
}

// "invoice.pdf.exe" reads as a PDF in any UI that truncates long names.
export function hasDoubleExtension(filename) {
  const parts = (filename ?? '').toLowerCase().split('.');
  if (parts.length < 3) return false;
  const inner = parts[parts.length - 2];
  const outer = parts[parts.length - 1];
  return EXECUTABLE.has(outer) && ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png', 'txt'].includes(inner);
}

export function sniffType(content) {
  if (!content) return '';
  const bytes = new Uint8Array(content);
  for (const { type, bytes: signature } of SIGNATURES) {
    if (signature.every((byte, i) => bytes[i] === byte)) return type;
  }
  return '';
}

export function assessAttachment(attachment) {
  if (!attachment) return { level: 'ok', reasons: [] };

  const extension = extensionOf(attachment.filename);
  const sniffed = sniffType(attachment.content);
  const declared = (attachment.mimeType ?? '').toLowerCase();
  const reasons = [];

  if (hasDoubleExtension(attachment.filename)) {
    reasons.push({ kind: 'double-extension', text: `Disguised as a document but ends in .${extension}` });
  } else if (EXECUTABLE.has(extension)) {
    reasons.push({ kind: 'executable', text: `.${extension} files can run code` });
  }

  if (ARCHIVE.has(extension)) {
    reasons.push({ kind: 'archive', text: 'Archive contents are not inspected' });
  }

  // Only meaningful when we actually recognised the bytes, and octet-stream is
  // a non-claim rather than a wrong one.
  if (sniffed && declared && declared !== 'application/octet-stream' && sniffed !== declared) {
    reasons.push({ kind: 'type-mismatch', text: `Declared ${declared} but the bytes are ${sniffed}` });
  }

  const severe = reasons.some((r) => r.kind === 'double-extension' || r.kind === 'executable' || r.kind === 'type-mismatch');
  return { level: severe ? 'danger' : reasons.length ? 'warn' : 'ok', reasons, sniffed, extension };
}

export async function sha256(content) {
  const digest = await crypto.subtle.digest('SHA-256', content);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
