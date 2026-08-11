import { describe, it, expect } from 'vitest';
import { buildMimeTree, flattenTree, countParts, parseContentType, unfoldHeaders } from '../src/lib/mime-tree.js';
import { loadFixture } from './helpers/load-fixture.js';

const decode = async (name) => new TextDecoder().decode(await loadFixture(name));

describe('parseContentType', () => {
  it('splits the type from its parameters', () => {
    const parsed = parseContentType('multipart/mixed; boundary="MIX"; charset=utf-8');
    expect(parsed.type).toBe('multipart/mixed');
    expect(parsed.params.boundary).toBe('MIX');
    expect(parsed.params.charset).toBe('utf-8');
  });

  it('defaults to text/plain when absent', () => {
    expect(parseContentType('').type).toBe('text/plain');
  });

  it('lowercases the type but preserves parameter case', () => {
    const parsed = parseContentType('TEXT/HTML; name="Report.PDF"');
    expect(parsed.type).toBe('text/html');
    expect(parsed.params.name).toBe('Report.PDF');
  });
});

describe('unfoldHeaders', () => {
  it('joins continuation lines onto the header they belong to', () => {
    const headers = unfoldHeaders('Subject: a very\r\n  long subject\r\nTo: bob@example.com');
    expect(headers).toEqual([
      { key: 'Subject', value: 'a very long subject' },
      { key: 'To', value: 'bob@example.com' },
    ]);
  });
});

describe('buildMimeTree', () => {
  it('returns null for empty source', () => {
    expect(buildMimeTree('')).toBeNull();
  });

  it('reports a single part for a plain text message', async () => {
    const tree = buildMimeTree(await decode('plain-text.eml'));
    expect(tree.type).toBe('text/plain');
    expect(tree.children).toEqual([]);
    expect(countParts(tree)).toBe(1);
  });

  it('recovers the alternative structure', async () => {
    const tree = buildMimeTree(await decode('multipart-alternative.eml'));
    expect(tree.type).toBe('multipart/alternative');
    expect(tree.children.map((c) => c.type)).toEqual(['text/plain', 'text/html']);
  });

  it('records the filename and encoding of an attachment part', async () => {
    const tree = buildMimeTree(await decode('with-attachment.eml'));
    const parts = flattenTree(tree);
    const report = parts.find((p) => p.filename === 'report.txt');
    expect(report.type).toBe('text/plain');
    expect(report.encoding).toBe('base64');
    expect(report.disposition).toBe('attachment');
  });

  it('descends into a nested rfc822 message', async () => {
    const tree = buildMimeTree(await decode('nested-rfc822.eml'));
    const parts = flattenTree(tree);
    const nested = parts.find((p) => p.type === 'message/rfc822');
    expect(nested).toBeDefined();
    expect(nested.children).toHaveLength(1);
    expect(parts.some((p) => p.depth > nested.depth)).toBe(true);
  });

  it('tracks nesting depth from the root', async () => {
    const tree = buildMimeTree(await decode('with-attachment.eml'));
    expect(tree.depth).toBe(0);
    expect(tree.children.every((c) => c.depth === 1)).toBe(true);
  });

  it('records the charset of a text part', async () => {
    const tree = buildMimeTree(await decode('quoted-printable-latin1.eml'));
    const text = flattenTree(tree).find((p) => p.charset);
    expect(text.charset.toLowerCase()).toContain('8859');
  });

  it('survives a truncated message without throwing', async () => {
    const tree = buildMimeTree(await decode('truncated.eml'));
    expect(tree).not.toBeNull();
    expect(countParts(tree)).toBeGreaterThanOrEqual(1);
  });
});
