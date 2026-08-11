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

  it('escapes filenames rather than interpreting them as html', () => {
    const el = renderAttachments(
      [{ filename: '<b>x</b>.txt', mimeType: 'text/plain', size: 1, content: new ArrayBuffer(1), disposition: 'attachment', related: false }],
      { createUrl }
    );
    expect(el.querySelectorAll('b')).toHaveLength(0);
    expect(el.textContent).toContain('<b>x</b>.txt');
  });
});
