import { describe, it, expect } from 'vitest';
import { buildCidMap, inlineCid } from '../src/lib/inline-cid.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

let counter = 0;
const fakeCreateUrl = () => `blob:fake/${counter++}`;

describe('buildCidMap', () => {
  it('maps content ids to created urls', async () => {
    counter = 0;
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    const map = buildCidMap(model.attachments, fakeCreateUrl);
    expect(map.get('logo@example.com')).toBe('blob:fake/0');
  });

  it('ignores attachments without a content id', () => {
    const map = buildCidMap(
      [{ contentId: '', mimeType: 'text/plain', content: new ArrayBuffer(1) }],
      fakeCreateUrl
    );
    expect(map.size).toBe(0);
  });
});

describe('inlineCid', () => {
  it('rewrites cid references to mapped urls', () => {
    const map = new Map([['logo@example.com', 'blob:fake/9']]);
    const out = inlineCid('<img src="cid:logo@example.com" alt="logo">', map);
    expect(out).toContain('src="blob:fake/9"');
    expect(out).not.toContain('cid:');
  });

  it('accepts cid references wrapped in angle brackets', () => {
    const map = new Map([['logo@example.com', 'blob:fake/9']]);
    expect(inlineCid('<img src="cid:<logo@example.com>">', map)).toContain('blob:fake/9');
  });

  it('leaves unmatched cid references alone', () => {
    const out = inlineCid('<img src="cid:missing@example.com">', new Map([['other', 'blob:x']]));
    expect(out).toContain('cid:missing@example.com');
  });

  it('resolves the related fixture end to end', async () => {
    counter = 0;
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    const map = buildCidMap(model.attachments, fakeCreateUrl);
    expect(inlineCid(model.html, map)).toContain('src="blob:fake/0"');
  });
});
