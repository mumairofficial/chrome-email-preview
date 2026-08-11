import { isPdf, PDF_MIME_TYPE } from './pdf.js';

// WHY THIS LIST IS SHORT: a preview opens a blob URL in a top-level tab, and a
// blob minted here inherits the *extension's* origin. Anything that can execute
// script in that document — text/html, image/svg+xml, xml — would run with the
// extension's privileges, so those are deliberately never previewable. They can
// still be downloaded, where the OS decides what opens them.
const SAFE_IMAGES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const AS_PLAIN_TEXT = new Set([
  'text/plain',
  'text/calendar',
  'application/json',
]);

// Returns the MIME type the preview blob should carry, or '' when the
// attachment must not be previewed.
export function previewTypeFor(attachment) {
  if (!attachment) return '';
  if (isPdf(attachment)) return PDF_MIME_TYPE;

  const declared = (attachment.mimeType ?? '').toLowerCase();
  if (SAFE_IMAGES.has(declared)) return declared;
  if (AS_PLAIN_TEXT.has(declared)) return 'text/plain';
  return '';
}

export function isPreviewable(attachment) {
  return previewTypeFor(attachment) !== '';
}
