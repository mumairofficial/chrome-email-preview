import { describe, it, expect } from 'vitest';
import { extractLinks, summarizeLinks, isPunycode, textClaimsDifferentHost } from '../src/lib/links.js';

describe('extractLinks', () => {
  it('returns nothing for empty html', () => {
    expect(extractLinks('')).toEqual([]);
  });

  it('collects href, text and host', () => {
    const [link] = extractLinks('<a href="https://corp.com/report">Read the report</a>');
    expect(link).toMatchObject({
      href: 'https://corp.com/report',
      text: 'Read the report',
      host: 'corp.com',
      mismatch: false,
    });
  });

  it('skips mailto, tel, anchors and cid links', () => {
    const html = `
      <a href="mailto:a@b.com">mail</a>
      <a href="tel:+123">call</a>
      <a href="#top">top</a>
      <a href="cid:img1">inline</a>
      <a href="https://corp.com">real</a>`;
    expect(extractLinks(html).map((l) => l.host)).toEqual(['corp.com']);
  });

  it('flags a link whose text claims a different domain', () => {
    const [link] = extractLinks('<a href="https://evil.example/login">https://bank.com/login</a>');
    expect(link.mismatch).toBe(true);
  });

  it('does not flag a subdomain of the claimed domain', () => {
    const [link] = extractLinks('<a href="https://mail.corp.com/x">corp.com</a>');
    expect(link.mismatch).toBe(false);
  });

  it('does not flag ordinary prose as a claim', () => {
    const [link] = extractLinks('<a href="https://evil.example">Click here to continue</a>');
    expect(link.mismatch).toBe(false);
  });

  it('flags punycode hosts', () => {
    const [link] = extractLinks('<a href="https://xn--80ak6aa92e.com">apple.com</a>');
    expect(link.punycode).toBe(true);
  });

  it('marks plain http as insecure', () => {
    const [link] = extractLinks('<a href="http://corp.com">x</a>');
    expect(link.insecure).toBe(true);
  });

  it('collapses whitespace in link text', () => {
    const [link] = extractLinks('<a href="https://corp.com">read\n   the   report</a>');
    expect(link.text).toBe('read the report');
  });
});

describe('summarizeLinks', () => {
  it('counts suspicious links and lists distinct hosts', () => {
    const links = extractLinks(`
      <a href="https://evil.example">bank.com</a>
      <a href="https://corp.com/a">a</a>
      <a href="https://corp.com/b">b</a>`);
    const summary = summarizeLinks(links);
    expect(summary.total).toBe(3);
    expect(summary.suspicious).toBe(1);
    expect(summary.hosts).toEqual(['corp.com', 'evil.example']);
  });
});

describe('helpers', () => {
  it('detects punycode labels', () => {
    expect(isPunycode('xn--80ak6aa92e.com')).toBe(true);
    expect(isPunycode('corp.com')).toBe(false);
  });

  it('compares registrable domains, not raw hosts', () => {
    expect(textClaimsDifferentHost('corp.com', 'mail.corp.com')).toBe(false);
    expect(textClaimsDifferentHost('corp.com', 'corp.evil.example')).toBe(true);
  });
});
