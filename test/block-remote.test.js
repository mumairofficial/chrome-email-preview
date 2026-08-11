import { describe, it, expect } from 'vitest';
import { blockRemote } from '../src/lib/block-remote.js';
import { sanitizeHtml } from '../src/lib/sanitize-html.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

// data-blocked-src="X" contains the substring src="X", so attribute assertions
// have to go through the DOM rather than string matching.
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

describe('blockRemote', () => {
  it('strips remote image src and records it', () => {
    const { html, blockedCount } = blockRemote('<img src="https://t.example.com/p.gif">');
    expect(blockedCount).toBe(1);
    const img = parse(html).querySelector('img');
    expect(img.hasAttribute('src')).toBe(false);
    expect(img.getAttribute('data-blocked-src')).toBe('https://t.example.com/p.gif');
  });

  it('blocks protocol-relative and plain http images', () => {
    expect(blockRemote('<img src="//t.example.com/p.gif">').blockedCount).toBe(1);
    expect(blockRemote('<img src="http://t.example.com/p.gif">').blockedCount).toBe(1);
  });

  it('leaves cid, data and blob images alone', () => {
    const src = '<img src="cid:a@b"><img src="data:image/gif;base64,AA"><img src="blob:x">';
    const { html, blockedCount } = blockRemote(src);
    expect(blockedCount).toBe(0);
    expect(html).toContain('cid:a@b');
    expect(html).toContain('blob:x');
  });

  it('strips remote url() from inline styles and style blocks', () => {
    const inline = blockRemote('<div style="background: url(https://t.example.com/b.png) no-repeat">x</div>');
    expect(inline.blockedCount).toBe(1);
    expect(inline.html).not.toContain('t.example.com');

    const block = blockRemote('<style>.a{background-image:url("https://t.example.com/c.png")}</style>');
    expect(block.blockedCount).toBe(1);
    expect(block.html).not.toContain('t.example.com');
  });

  it('strips the legacy background attribute', () => {
    // A bare <td> is discarded by the HTML parser, so it has to sit in a table.
    const { html, blockedCount } = blockRemote(
      '<table><tr><td background="https://t.example.com/d.png">x</td></tr></table>'
    );
    expect(blockedCount).toBe(1);
    const td = parse(html).querySelector('td');
    expect(td.hasAttribute('background')).toBe(false);
    expect(td.getAttribute('data-blocked-background')).toBe('https://t.example.com/d.png');
  });

  it('reports exactly one blocked resource for the hostile fixture', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const { blockedCount } = blockRemote(sanitizeHtml(model.html));
    expect(blockedCount).toBe(1);
  });

  it('leaves link hrefs intact — only fetched subresources are blocked', () => {
    const { html, blockedCount } = blockRemote('<a href="https://ok.example.com/x">a</a>');
    expect(blockedCount).toBe(0);
    expect(html).toContain('https://ok.example.com/x');
  });
});
