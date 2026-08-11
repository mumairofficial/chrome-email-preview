import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/lib/sanitize-html.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const frag = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body;
};

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('keeps ordinary content and inline styles', () => {
    const out = sanitizeHtml('<p style="color:red">hi <b>there</b></p>');
    expect(out).toContain('<b>there</b>');
    expect(out).toContain('color:red');
  });

  it('hoists head style blocks into the fragment', () => {
    const out = sanitizeHtml('<html><head><style>p{color:blue}</style></head><body><p>x</p></body></html>');
    expect(out).toContain('p{color:blue}');
    expect(out).toContain('<p>x</p>');
  });

  it('strips every executable vector from the hostile fixture', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const body = frag(sanitizeHtml(model.html));

    expect(body.querySelectorAll('script')).toHaveLength(0);
    expect(body.querySelectorAll('iframe')).toHaveLength(0);
    expect(body.innerHTML).not.toContain('onerror');
    expect(body.innerHTML).not.toContain('javascript:');
    expect(body.textContent).toContain('Visible text.');
  });

  it('removes position fixed and sticky', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const out = sanitizeHtml(model.html);
    expect(out).not.toMatch(/position\s*:\s*fixed/i);
    expect(sanitizeHtml('<div style="position:sticky;color:red">x</div>')).not.toMatch(/sticky/i);
  });

  it('drops meta, link and base so the email cannot override our CSP or load remote css', () => {
    const out = sanitizeHtml(
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *">' +
      '<link rel="stylesheet" href="https://evil.example.com/a.css"><base href="https://evil.example.com/">' +
      '</head><body><p>x</p></body></html>'
    );
    expect(out).not.toContain('<meta');
    expect(out).not.toContain('<link');
    expect(out).not.toContain('<base');
  });

  it('preserves cid, https and mailto urls', () => {
    const out = sanitizeHtml(
      '<img src="cid:a@b"><a href="https://ok.example.com/x">a</a><a href="mailto:x@y.z">b</a>'
    );
    expect(out).toContain('cid:a@b');
    expect(out).toContain('https://ok.example.com/x');
    expect(out).toContain('mailto:x@y.z');
  });
});
