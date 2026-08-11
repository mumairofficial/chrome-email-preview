export const PDF_MIME_TYPE = 'application/pdf';

// The PDF spec allows bytes before the %PDF- header, so the signature is
// searched for rather than checked at offset 0.
const HEADER_SEARCH_BYTES = 1024;
const HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

function hasPdfHeader(content) {
  if (!content) return false;
  const bytes = new Uint8Array(content);
  const limit = Math.min(bytes.length, HEADER_SEARCH_BYTES) - HEADER.length;

  for (let start = 0; start <= limit; start += 1) {
    if (HEADER.every((byte, offset) => bytes[start + offset] === byte)) return true;
  }
  return false;
}

export function isPdf(attachment) {
  if (!attachment) return false;
  if (attachment.mimeType === PDF_MIME_TYPE) return true;
  // Mailers routinely send PDFs as application/octet-stream, so fall back to the
  // filename — but only believe it if the bytes agree.
  if (!/\.pdf$/i.test(attachment.filename ?? '')) return false;
  return hasPdfHeader(attachment.content);
}
