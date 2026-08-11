import { describe, it, expect } from 'vitest';
import { buildSrcdoc, IFRAME_SANDBOX, HEIGHT_MESSAGE_TYPE } from '../src/lib/build-srcdoc.js';

const cspOf = (doc) =>
  doc.querySelector('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

describe('IFRAME_SANDBOX', () => {
  it('never grants same-origin — this is the security boundary', () => {
    expect(IFRAME_SANDBOX).not.toContain('allow-same-origin');
  });

  it('grants only scripts and escaping popups', () => {
    expect(IFRAME_SANDBOX.split(/\s+/).sort()).toEqual([
      'allow-popups',
      'allow-popups-to-escape-sandbox',
      'allow-scripts',
    ]);
  });
});

describe('buildSrcdoc', () => {
  it('blocks remote images in the default policy', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' })));
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('img-src data: blob:');
    expect(csp).not.toContain('https:');
  });

  it('allows remote images only when asked', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1', allowRemoteImages: true })));
    expect(csp).toContain('img-src data: blob: https: http:');
  });

  it('permits scripts only via the given nonce', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' })));
    expect(csp).toContain("script-src 'nonce-N1'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });

  it('embeds exactly one script and it carries the nonce', () => {
    const doc = parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' }));
    const scripts = doc.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('nonce')).toBe('N1');
    expect(scripts[0].textContent).toContain(HEIGHT_MESSAGE_TYPE);
  });

  it('opens links in a new tab by default', () => {
    const doc = parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' }));
    expect(doc.querySelector('base').getAttribute('target')).toBe('_blank');
  });

  it('includes the message body', () => {
    expect(buildSrcdoc('<p>hello</p>', { nonce: 'N1' })).toContain('<p>hello</p>');
  });

  it('rejects a missing nonce rather than emitting an unguarded policy', () => {
    expect(() => buildSrcdoc('<p>x</p>', {})).toThrow(/nonce/i);
  });
});
