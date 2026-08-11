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

  it('renders a fetched message with header card, tabs and body frame', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'multipart-alternative.eml',
    });

    expect(app.querySelector('.header-card__subject').textContent).toBe('Alternative parts');
    expect(app.querySelector('.toolbar')).not.toBeNull();

    const frame = app.querySelector('iframe.body-frame');
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.srcdoc).toContain('HTML version.');

    const tabs = [...app.querySelectorAll('.tabbar button')].map((b) => b.textContent);
    expect(tabs).toEqual(['HTML', 'Text', 'Raw', 'Headers']);
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

  it('lists attachments below the body', async () => {
    const app = await bootViewer({
      search: '?src=https://example.com/a.eml',
      fixture: 'with-attachment.eml',
    });
    expect(app.querySelector('.attachments').textContent).toContain('report.txt');
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
