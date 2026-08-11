import { describe, it, expect } from 'vitest';
import { renderBody } from '../src/viewer/render-pipeline.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const opts = (extra) => ({ nonce: 'N1', createUrl: () => 'blob:fake/0', ...extra });
const parse = async (name) => parseEmail(await loadFixture(name));
const doc = (srcdoc) => new DOMParser().parseFromString(srcdoc, 'text/html');

describe('renderBody', () => {
  it('blocks the tracking pixel and reports the count', async () => {
    const { srcdoc, blockedCount } = renderBody(await parse('hostile.eml'), opts());
    expect(blockedCount).toBe(1);
    // The URL survives in data-blocked-src, so assert on the live src attribute.
    expect(doc(srcdoc).querySelector('img[src*="tracker.example.com"]')).toBeNull();
    expect(doc(srcdoc).querySelector('img[data-blocked-src]')).not.toBeNull();
    expect(srcdoc).toContain('img-src data: blob:;');
  });

  it('lets remote images through when allowed, with the relaxed policy', async () => {
    const { srcdoc, blockedCount } = renderBody(
      await parse('hostile.eml'),
      opts({ allowRemoteImages: true })
    );
    expect(blockedCount).toBe(0);
    expect(srcdoc).toContain('https://tracker.example.com/pixel.gif');
    expect(srcdoc).toContain('img-src data: blob: https: http:');
  });

  it('strips scripts and iframes regardless of the remote setting', async () => {
    for (const allowRemoteImages of [false, true]) {
      const { srcdoc } = renderBody(await parse('hostile.eml'), opts({ allowRemoteImages }));
      expect(srcdoc).not.toContain('document.cookie');
      expect(srcdoc).not.toContain('evil.example.com');
      expect(srcdoc).not.toContain('onerror');
    }
  });

  it('inlines cid images', async () => {
    const { srcdoc } = renderBody(await parse('multipart-related-cid.eml'), opts());
    expect(srcdoc).toContain('src="blob:fake/0"');
  });

  it('falls back to escaped plain text when there is no html part', async () => {
    const { srcdoc } = renderBody(await parse('plain-text.eml'), opts());
    expect(srcdoc).toContain('<pre');
    expect(srcdoc).toContain('Hello Bob.');
  });

  it('escapes html metacharacters in the plain text fallback', () => {
    const model = { html: null, text: '<script>alert(1)</script>', attachments: [] };
    const { srcdoc } = renderBody(model, opts());
    expect(srcdoc).toContain('&lt;script&gt;');
    expect(srcdoc).not.toContain('<script>alert(1)</script>');
  });

  it('renders an empty-body notice when there is neither html nor text', () => {
    const { srcdoc } = renderBody({ html: null, text: null, attachments: [] }, opts());
    expect(srcdoc).toContain('This message has no readable body.');
  });
});
