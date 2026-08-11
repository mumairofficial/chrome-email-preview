import { describe, it, expect } from 'vitest';
import { isEmlUrl, shouldInterceptDownload, viewerUrlFor } from '../src/background/intercept-rules.js';

describe('isEmlUrl', () => {
  it('matches file and http(s) urls ending in .eml', () => {
    expect(isEmlUrl('file:///Users/me/msg.eml')).toBe(true);
    expect(isEmlUrl('https://example.com/a/b/msg.eml')).toBe(true);
    expect(isEmlUrl('http://example.com/msg.EML')).toBe(true);
  });

  it('matches despite a query string or fragment', () => {
    expect(isEmlUrl('https://example.com/msg.eml?token=1')).toBe(true);
    expect(isEmlUrl('https://example.com/msg.eml#top')).toBe(true);
  });

  it('matches percent-encoded paths', () => {
    expect(isEmlUrl('file:///Users/me/my%20message.eml')).toBe(true);
  });

  it('rejects other extensions, other schemes and junk', () => {
    expect(isEmlUrl('https://example.com/msg.pdf')).toBe(false);
    expect(isEmlUrl('chrome-extension://abc/viewer.html')).toBe(false);
    expect(isEmlUrl('not a url')).toBe(false);
    expect(isEmlUrl(undefined)).toBe(false);
  });

  it('does not match a path that merely contains .eml', () => {
    expect(isEmlUrl('https://example.com/msg.eml.txt')).toBe(false);
  });
});

describe('shouldInterceptDownload', () => {
  it('intercepts message/rfc822 downloads', () => {
    expect(shouldInterceptDownload({ url: 'https://example.com/dl?id=7', mime: 'message/rfc822' })).toBe(true);
  });

  it('intercepts by .eml filename when the mime is generic', () => {
    expect(shouldInterceptDownload({
      url: 'https://example.com/dl?id=7',
      filename: '/Users/me/Downloads/msg.eml',
      mime: 'application/octet-stream',
    })).toBe(true);
  });

  it('prefers finalUrl when present', () => {
    expect(shouldInterceptDownload({ url: 'https://a.example/r', finalUrl: 'https://b.example/m.eml' })).toBe(true);
  });

  it('never intercepts our own blob or data downloads', () => {
    expect(shouldInterceptDownload({ url: 'blob:chrome-extension://abc/1', mime: 'message/rfc822' })).toBe(false);
    expect(shouldInterceptDownload({ url: 'data:message/rfc822,x', mime: 'message/rfc822' })).toBe(false);
  });

  it('ignores ordinary downloads and missing items', () => {
    expect(shouldInterceptDownload({ url: 'https://example.com/a.pdf', mime: 'application/pdf' })).toBe(false);
    expect(shouldInterceptDownload(null)).toBe(false);
  });
});

describe('viewerUrlFor', () => {
  it('encodes the source into the src param', () => {
    expect(viewerUrlFor('file:///a b.eml', 'chrome-extension://abc/viewer.html'))
      .toBe('chrome-extension://abc/viewer.html?src=file%3A%2F%2F%2Fa%20b.eml');
  });
});
