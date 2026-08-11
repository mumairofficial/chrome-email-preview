import { describe, it, expect } from 'vitest';
import { loadFromUrl, loadFromFile, isFileUrl, SourceError } from '../src/lib/source-loader.js';

const okResponse = (text) => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
});

describe('isFileUrl', () => {
  it('recognises file urls only', () => {
    expect(isFileUrl('file:///tmp/a.eml')).toBe(true);
    expect(isFileUrl('https://example.com/a.eml')).toBe(false);
  });
});

describe('loadFromUrl', () => {
  it('returns the fetched bytes', async () => {
    const buf = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => okResponse('hello'),
    });
    expect(new TextDecoder().decode(buf)).toBe('hello');
  });

  it('sends credentials for http but not for file', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(init.credentials);
      return okResponse('x');
    };
    await loadFromUrl('https://example.com/a.eml', { fetchImpl });
    await loadFromUrl('file:///tmp/a.eml', { fetchImpl });
    expect(seen).toEqual(['include', 'omit']);
  });

  it('reports file-access-denied when a file fetch throws', async () => {
    const err = await loadFromUrl('file:///tmp/a.eml', {
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err.kind).toBe('file-access-denied');
  });

  it('reports fetch-failed when an http fetch throws', async () => {
    const err = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }).catch((e) => e);
    expect(err.kind).toBe('fetch-failed');
  });

  it('reports fetch-failed with the status on a non-ok response', async () => {
    const err = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }).catch((e) => e);
    expect(err.kind).toBe('fetch-failed');
    expect(err.message).toContain('404');
  });
});

describe('loadFromFile', () => {
  it('returns the file bytes', async () => {
    const file = new File(['from disk'], 'a.eml', { type: 'message/rfc822' });
    const buf = await loadFromFile(file);
    expect(new TextDecoder().decode(buf)).toBe('from disk');
  });
});
