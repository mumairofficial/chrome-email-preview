import { describe, it, expect } from 'vitest';
import {
  assessAttachment, extensionOf, hasDoubleExtension, sniffType, sha256,
} from '../src/lib/attachment-risk.js';

const bytesOf = (...values) => new Uint8Array(values).buffer;
const PDF = bytesOf(0x25, 0x50, 0x44, 0x46, 0x2d);
const PNG = bytesOf(0x89, 0x50, 0x4e, 0x47);

describe('extensionOf', () => {
  it('lowercases the last extension', () => {
    expect(extensionOf('Report.PDF')).toBe('pdf');
    expect(extensionOf('noextension')).toBe('');
  });
});

describe('hasDoubleExtension', () => {
  it('catches a document name wrapping an executable', () => {
    expect(hasDoubleExtension('invoice.pdf.exe')).toBe(true);
    expect(hasDoubleExtension('photo.jpg.scr')).toBe(true);
  });

  it('leaves ordinary dotted names alone', () => {
    expect(hasDoubleExtension('report.final.pdf')).toBe(false);
    expect(hasDoubleExtension('archive.tar.gz')).toBe(false);
  });
});

describe('sniffType', () => {
  it('recognises known signatures', () => {
    expect(sniffType(PDF)).toBe('application/pdf');
    expect(sniffType(PNG)).toBe('image/png');
  });

  it('returns nothing for unknown bytes', () => {
    expect(sniffType(bytesOf(1, 2, 3, 4))).toBe('');
    expect(sniffType(null)).toBe('');
  });
});

describe('assessAttachment', () => {
  it('passes an ordinary pdf', () => {
    const risk = assessAttachment({ filename: 'q3.pdf', mimeType: 'application/pdf', content: PDF });
    expect(risk.level).toBe('ok');
    expect(risk.reasons).toEqual([]);
  });

  it('flags an executable as dangerous', () => {
    const risk = assessAttachment({ filename: 'setup.exe', mimeType: 'application/octet-stream', content: bytesOf(0) });
    expect(risk.level).toBe('danger');
    expect(risk.reasons[0].kind).toBe('executable');
  });

  it('flags a disguised double extension', () => {
    const risk = assessAttachment({ filename: 'invoice.pdf.exe', mimeType: 'application/octet-stream', content: bytesOf(0) });
    expect(risk.level).toBe('danger');
    expect(risk.reasons[0].kind).toBe('double-extension');
  });

  it('flags bytes that contradict the declared type', () => {
    const risk = assessAttachment({ filename: 'photo.png', mimeType: 'image/png', content: PDF });
    expect(risk.level).toBe('danger');
    expect(risk.reasons.some((r) => r.kind === 'type-mismatch')).toBe(true);
  });

  it('does not treat octet-stream as a contradicted claim', () => {
    const risk = assessAttachment({ filename: 'q3.pdf', mimeType: 'application/octet-stream', content: PDF });
    expect(risk.reasons.some((r) => r.kind === 'type-mismatch')).toBe(false);
  });

  it('warns about archives without calling them dangerous', () => {
    const risk = assessAttachment({ filename: 'files.zip', mimeType: 'application/zip', content: bytesOf(0x50, 0x4b, 0x03, 0x04) });
    expect(risk.level).toBe('warn');
    expect(risk.reasons[0].kind).toBe('archive');
  });

  it('handles a missing attachment', () => {
    expect(assessAttachment(null).level).toBe('ok');
  });
});

describe('sha256', () => {
  it('hashes the empty input to the known digest', async () => {
    expect(await sha256(new ArrayBuffer(0)))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('produces 64 hex characters', async () => {
    expect(await sha256(PDF)).toMatch(/^[0-9a-f]{64}$/);
  });
});
