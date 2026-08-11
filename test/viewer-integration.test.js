import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFixture } from './helpers/load-fixture.js';

// viewer.js is a side-effecting entry point: importing it boots the app against
// the current document and location. These tests exercise that wiring end to
// end, which the per-module unit tests cannot reach.
async function bootViewer({ search = '', fixture = null, permitted = true } = {}) {
  document.body.innerHTML = '<main id="app"></main>';
  window.history.replaceState({}, '', search || '/');

  globalThis.chrome = {
    permissions: {
      contains: async () => permitted,
      request: async () => true,
    },
  };

  if (fixture) {
    const bytes = await loadFixture(fixture);
    globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes });
  }

  vi.resetModules();
  await import('../src/viewer/viewer.js');
  // Let the load → parse → render promise chain settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.getElementById('app');
}

describe('viewer boot', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows the drop zone when opened with no src', async () => {
    const app = await bootViewer();
    expect(app.querySelector('.dropzone')).not.toBeNull();
    expect(app.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('renders a fetched message with app bar, tabs and body frame', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'multipart-alternative.eml',
    });

    expect(app.querySelector('.app-bar__subject').textContent).toBe('Alternative parts');
    expect(app.querySelector('.shell__rail .header-card')).not.toBeNull();

    const frame = app.querySelector('iframe.body-frame');
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.srcdoc).toContain('HTML version.');

    const tabs = [...app.querySelectorAll('.tabbar button')].map((b) => b.textContent);
    expect(tabs).toEqual(['HTML', 'Text', 'Raw', 'Headers', 'Structure', 'Security']);
  });

  it('switches to the plain text pane when the Text tab is clicked', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'multipart-alternative.eml',
    });

    app.querySelector('[data-tab-id="text"]').click();
    expect(app.querySelector('.plain-pane').textContent).toContain('Plain version.');
    expect(app.querySelector('iframe.body-frame')).toBeNull();
  });

  it('shows the blocked-content banner and clears it on load', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'hostile.eml',
    });

    expect(app.querySelector('.banner').textContent).toContain('1 remote resource blocked');

    app.querySelector('.banner button').click();
    expect(app.querySelector('.banner')).toBeNull();
    expect(app.querySelector('iframe.body-frame').srcdoc)
      .toContain('img-src data: blob: https: http:');
  });

  it('lists attachments in the details rail', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'with-attachment.eml',
    });
    expect(app.querySelector('.shell__rail .attachments').textContent).toContain('report.txt');
  });

  it('offers a preview link for a pdf attachment in the rail', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'with-pdf-attachment.eml',
    });

    const preview = app.querySelector('.shell__rail .attachment a[target="_blank"]');
    expect(preview.textContent).toBe('Preview');
  });

  describe('analysis panes', () => {
    it('shows the mime structure of the message', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'with-attachment.eml',
      });

      app.querySelector('[data-tab-id="structure"]').click();
      const text = app.querySelector('.structure').textContent;
      expect(text).toContain('multipart/mixed');
      expect(text).toContain('report.txt');
    });

    it('shows authentication, delivery, links and remote content', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'hostile.eml',
      });

      app.querySelector('[data-tab-id="security"]').click();
      const titles = [...app.querySelectorAll('.sec__title')].map((h) => h.textContent);
      expect(titles).toEqual(['Authentication', 'Delivery path', 'Links', 'Remote content']);
    });

    it('marks the security tab when the message has something worth seeing', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'hostile.eml',
      });

      const tab = app.querySelector('[data-tab-id="security"]');
      expect(tab.querySelector('.tabbar__alert')).not.toBeNull();
      expect(tab.title).toBeTruthy();
    });

    it('switches panes with the number keys', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'multipart-alternative.eml',
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
      expect(app.querySelector('.structure')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      expect(app.querySelector('iframe.body-frame')).not.toBeNull();
    });

    it('shows a calendar invite as an event card', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'calendar-invite.eml',
      });

      const card = app.querySelector('.event-card');
      expect(card.textContent).toContain('Quarterly review');
      expect(card.textContent).toContain('Invitation');
      expect(card.textContent).toContain('Ana Ruiz');
    });

    it('reports passing authentication and a disguised link', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'calendar-invite.eml',
      });

      app.querySelector('[data-tab-id="security"]').click();
      const chips = [...app.querySelectorAll('.chip')].map((c) => c.textContent);
      expect(chips).toContain('SPF pass');
      expect(chips).toContain('DKIM pass');
      expect(app.querySelector('.link--suspect')).not.toBeNull();
      expect(app.textContent).toContain('tracking pixel');
    });

    it('lists both delivery hops oldest first', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'calendar-invite.eml',
      });

      app.querySelector('[data-tab-id="security"]').click();
      const hops = [...app.querySelectorAll('.hop__where')].map((h) => h.textContent);
      expect(hops).toEqual(['mail.corp.com', 'mx.corp.com']);
    });

    it('opens and closes the find bar', async () => {
      const app = await bootViewer({
        search: '?src=https://example.com/a.eml',
        fixture: 'multipart-alternative.eml',
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
      expect(app.querySelector('.find-bar')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(app.querySelector('.find-bar')).toBeNull();
    });
  });

  it('shows the drop zone and error cards without the shell', async () => {
    const app = await bootViewer();
    expect(app.classList.contains('app--empty')).toBe(true);
    expect(app.querySelector('.shell')).toBeNull();
  });

  it('toggles the rail without rebuilding the body frame', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'multipart-alternative.eml',
    });

    const shell = app.querySelector('.shell');
    const toggle = app.querySelector('.app-bar__toggle');
    const frameBefore = app.querySelector('iframe.body-frame');
    const wasOpen = shell.classList.contains('shell--rail-open');

    toggle.click();

    expect(shell.classList.contains('shell--rail-open')).toBe(!wasOpen);
    expect(toggle.getAttribute('aria-expanded')).toBe(String(!wasOpen));
    // Same element, not a replacement: re-rendering would reload the message
    // and lose the reader's scroll position.
    expect(app.querySelector('iframe.body-frame')).toBe(frameBefore);
  });

  it('offers to request permission when the host is not granted', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'plain-text.eml',
      permitted: false,
    });

    expect(app.querySelector('.error-card').textContent).toContain('Permission needed');
    expect(app.querySelector('.error-card button').textContent).toBe('Grant access');
  });

  it('shows the file-access error card when a file url cannot be read', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    window.history.replaceState({}, '', '?src=file:///tmp/a.eml');
    globalThis.chrome = { permissions: { contains: async () => true, request: async () => true } };
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };

    vi.resetModules();
    await import('../src/viewer/viewer.js');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const app = document.getElementById('app');
    expect(app.querySelector('.error-card').textContent).toContain('Allow access to file URLs');
  });

  it('shows a parse error card for bytes that are not an email', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    window.history.replaceState({}, '', '?src=https://example.com/a.eml');
    globalThis.chrome = { permissions: { contains: async () => true, request: async () => true } };
    const junk = new TextEncoder().encode('not an email at all').buffer;
    globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => junk });

    vi.resetModules();
    await import('../src/viewer/viewer.js');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('app').querySelector('.error-card').textContent)
      .toContain('Not a readable email');
  });
});
