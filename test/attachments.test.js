import { describe, it, expect } from 'vitest';
import { renderAttachments } from '../src/viewer/ui/attachments.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const createUrl = () => 'blob:fake/0';

describe('renderAttachments', () => {
  it('returns null when there are no attachments', () => {
    expect(renderAttachments([], { createUrl })).toBeNull();
  });

  it('returns null when every attachment is an inline cid image', async () => {
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    expect(renderAttachments(model.attachments, { createUrl })).toBeNull();
  });

  it('lists a regular attachment with filename, type and size', async () => {
    const model = await parseEmail(await loadFixture('with-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });
    expect(el.textContent).toContain('report.txt');
    expect(el.textContent).toContain('text/plain');
    expect(el.textContent).toContain('12 B');
  });

  it('gives a regular attachment a download link', async () => {
    const model = await parseEmail(await loadFixture('with-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });
    const link = el.querySelector('a[download]');
    expect(link.getAttribute('href')).toBe('blob:fake/0');
    expect(link.getAttribute('download')).toBe('report.txt');
  });

  it('opens a nested rfc822 attachment instead of downloading it', async () => {
    const model = await parseEmail(await loadFixture('nested-rfc822.eml'));
    const opened = [];
    const el = renderAttachments(model.attachments, { createUrl, onOpenNested: (a) => opened.push(a) });
    const button = el.querySelector('button');
    expect(button.textContent).toContain('Open');
    button.click();
    expect(opened).toHaveLength(1);
    expect(opened[0].mimeType).toBe('message/rfc822');
  });

  it('offers preview alongside download for a declared pdf', async () => {
    const model = await parseEmail(await loadFixture('with-pdf-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });

    const declared = [...el.querySelectorAll('.attachment')]
      .find((li) => li.textContent.includes('declared.pdf'));
    const actions = [...declared.querySelectorAll('a')].map((a) => a.textContent);

    expect(actions).toEqual(['Preview', 'Download']);
  });

  it('opens a preview in a new tab rather than saving it', async () => {
    const model = await parseEmail(await loadFixture('with-pdf-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });

    const preview = el.querySelector('a[target="_blank"]');
    expect(preview.textContent).toBe('Preview');
    expect(preview.rel).toBe('noopener');
    expect(preview.hasAttribute('download')).toBe(false);
  });

  it('reuses the download url for a correctly declared pdf', async () => {
    const model = await parseEmail(await loadFixture('with-pdf-attachment.eml'));
    const urls = [];
    const counting = (blob) => {
      urls.push(blob.type);
      return `blob:fake/${urls.length - 1}`;
    };
    const el = renderAttachments(model.attachments, { createUrl: counting });

    const declared = [...el.querySelectorAll('.attachment')]
      .find((li) => li.textContent.includes('declared.pdf'));
    const [preview, download] = declared.querySelectorAll('a');

    expect(preview.getAttribute('href')).toBe(download.getAttribute('href'));
  });

  it('gives a mislabelled pdf a preview blob carrying the real type', async () => {
    const model = await parseEmail(await loadFixture('with-pdf-attachment.eml'));
    const types = [];
    const recording = (blob) => {
      types.push(blob.type);
      return `blob:fake/${types.length - 1}`;
    };
    const el = renderAttachments(model.attachments, { createUrl: recording });

    const sniffed = [...el.querySelectorAll('.attachment')]
      .find((li) => li.textContent.includes('sniffed.pdf'));
    const [preview, download] = sniffed.querySelectorAll('a');

    // Chrome downloads an octet-stream blob instead of previewing it, so the
    // two links must point at differently typed blobs.
    expect(preview.getAttribute('href')).not.toBe(download.getAttribute('href'));
    expect(types).toContain('application/pdf');
    expect(types).toContain('application/octet-stream');
  });

  it('previews a plain text attachment', async () => {
    const model = await parseEmail(await loadFixture('with-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });
    expect(el.querySelector('a[target="_blank"]').textContent).toBe('Preview');
  });

  // A blob minted here carries the extension's origin, so a scriptable
  // attachment opened top-level would run with the extension's privileges.
  it('offers no preview for scriptable or unknown binary attachments', () => {
    const make = (mimeType, filename) => renderAttachments(
      [{ filename, mimeType, size: 4, content: new ArrayBuffer(4), disposition: 'attachment', related: false }],
      { createUrl }
    );

    for (const [type, name] of [['text/html', 'page.html'], ['image/svg+xml', 'logo.svg'], ['application/zip', 'files.zip']]) {
      const el = make(type, name);
      expect(el.querySelector('a[target="_blank"]'), type).toBeNull();
      expect([...el.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Download']);
    }
  });

  it('flags a disguised executable and withholds preview from it', () => {
    const el = renderAttachments(
      [{ filename: 'invoice.pdf.exe', mimeType: 'application/octet-stream', size: 4, content: new ArrayBuffer(4), disposition: 'attachment', related: false }],
      { createUrl }
    );
    expect(el.querySelector('.attachment__risk--danger')).not.toBeNull();
    expect(el.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('computes a sha-256 digest on request', async () => {
    const el = renderAttachments(
      [{ filename: 'a.bin', mimeType: 'application/octet-stream', size: 0, content: new ArrayBuffer(0), disposition: 'attachment', related: false }],
      { createUrl }
    );
    el.querySelector('.attachment__hash').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.querySelector('.attachment__digest').textContent)
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('escapes filenames rather than interpreting them as html', () => {
    const el = renderAttachments(
      [{ filename: '<b>x</b>.txt', mimeType: 'text/plain', size: 1, content: new ArrayBuffer(1), disposition: 'attachment', related: false }],
      { createUrl }
    );
    expect(el.querySelectorAll('b')).toHaveLength(0);
    expect(el.textContent).toContain('<b>x</b>.txt');
  });
});
