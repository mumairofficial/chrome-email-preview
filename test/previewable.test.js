import { describe, it, expect } from 'vitest';
import { previewTypeFor, isPreviewable } from '../src/lib/previewable.js';

const pdfBytes = new TextEncoder().encode('%PDF-1.4').buffer;
const att = (mimeType, filename = 'f', content = new ArrayBuffer(4)) => ({ mimeType, filename, content });

describe('previewTypeFor', () => {
  it('previews a pdf as application/pdf', () => {
    expect(previewTypeFor(att('application/pdf'))).toBe('application/pdf');
  });

  it('previews a pdf mislabelled octet-stream by sniffing it', () => {
    expect(previewTypeFor(att('application/octet-stream', 'q3.pdf', pdfBytes))).toBe('application/pdf');
  });

  it('previews raster images under their own type', () => {
    expect(previewTypeFor(att('image/png'))).toBe('image/png');
    expect(previewTypeFor(att('image/jpeg'))).toBe('image/jpeg');
  });

  it('previews text-ish parts as plain text', () => {
    expect(previewTypeFor(att('text/plain'))).toBe('text/plain');
    expect(previewTypeFor(att('text/calendar'))).toBe('text/plain');
  });

  // A blob minted by the viewer carries the extension origin, so anything
  // scriptable would execute with the extension's privileges.
  it('refuses to preview scriptable types', () => {
    expect(previewTypeFor(att('text/html'))).toBe('');
    expect(previewTypeFor(att('image/svg+xml'))).toBe('');
    expect(previewTypeFor(att('application/xml'))).toBe('');
  });

  it('refuses unknown binary types', () => {
    expect(previewTypeFor(att('application/octet-stream'))).toBe('');
    expect(previewTypeFor(att('application/zip'))).toBe('');
    expect(previewTypeFor(null)).toBe('');
  });

  it('isPreviewable mirrors the type decision', () => {
    expect(isPreviewable(att('image/png'))).toBe(true);
    expect(isPreviewable(att('text/html'))).toBe(false);
  });
});
