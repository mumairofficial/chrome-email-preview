import { describe, it, expect } from 'vitest';
import { parseEmail, normalizeCid, EmailParseError } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const parse = async (name) => parseEmail(await loadFixture(name));

describe('parseEmail', () => {
  it('reads headers and a plain text body', async () => {
    const m = await parse('plain-text.eml');
    expect(m.subject).toBe('Plain text hello');
    expect(m.from).toEqual({ name: 'Alice', address: 'alice@example.com' });
    expect(m.to[0].address).toBe('bob@example.com');
    expect(m.text).toContain('Hello Bob.');
    expect(m.html).toBeNull();
    expect(m.headers.some((h) => h.key.toLowerCase() === 'message-id')).toBe(true);
  });

  it('reads an html-only body', async () => {
    const m = await parse('html-only.eml');
    expect(m.html).toContain('<h1>Heading</h1>');
  });

  it('exposes both parts of multipart/alternative', async () => {
    const m = await parse('multipart-alternative.eml');
    expect(m.text).toContain('Plain version.');
    expect(m.html).toContain('HTML version.');
  });

  it('marks cid images as related inline attachments', async () => {
    const m = await parse('multipart-related-cid.eml');
    expect(m.attachments).toHaveLength(1);
    const [img] = m.attachments;
    expect(img.contentId).toBe('logo@example.com');
    expect(img.mimeType).toBe('image/gif');
    expect(img.disposition).toBe('inline');
    expect(img.size).toBeGreaterThan(0);
  });

  it('exposes regular attachments with size', async () => {
    const m = await parse('with-attachment.eml');
    const att = m.attachments.find((a) => a.filename === 'report.txt');
    expect(att).toBeDefined();
    expect(att.size).toBe(12);
    expect(new TextDecoder().decode(att.content)).toBe('hello report');
  });

  it('exposes a nested rfc822 attachment', async () => {
    const m = await parse('nested-rfc822.eml');
    const nested = m.attachments.find((a) => a.mimeType === 'message/rfc822');
    expect(nested).toBeDefined();
    const inner = await parseEmail(nested.content);
    expect(inner.subject).toBe('Original subject');
  });

  it('decodes quoted-printable iso-8859-1', async () => {
    const m = await parse('quoted-printable-latin1.eml');
    expect(m.text).toContain('Café au lait');
  });

  it('decodes base64 shift_jis', async () => {
    const m = await parse('base64-shiftjis.eml');
    expect(m.text).toContain('テスト');
  });

  it('decodes RFC 2047 encoded words in subject and display name', async () => {
    const m = await parse('encoded-word.eml');
    expect(m.subject).toBe('Subject with ✓');
    expect(m.from.name).toBe('José García');
  });

  it('renders what it can from a truncated message', async () => {
    const m = await parse('truncated.eml');
    expect(m.subject).toBe('Truncated message');
    expect(m.text).toContain('This message stops mid-');
  });

  it('throws EmailParseError on bytes that are not a message', async () => {
    const bytes = new TextEncoder().encode('not an email at all').buffer;
    await expect(parseEmail(bytes)).rejects.toBeInstanceOf(EmailParseError);
  });
});

describe('normalizeCid', () => {
  it('strips angle brackets', () => {
    expect(normalizeCid('<logo@example.com>')).toBe('logo@example.com');
  });

  it('passes through bare ids and empty values', () => {
    expect(normalizeCid('logo@example.com')).toBe('logo@example.com');
    expect(normalizeCid(undefined)).toBe('');
  });
});
