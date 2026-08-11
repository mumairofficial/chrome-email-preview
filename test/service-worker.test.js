import { describe, it, expect, beforeEach, vi } from 'vitest';

// The worker registers listeners at import time, so the fake chrome global has
// to exist first and the module cache has to be dropped between tests.
function installChrome() {
  const listeners = {};
  const capture = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });

  globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://abc/${path}` },
    webNavigation: { onBeforeNavigate: capture('navigate') },
    downloads: {
      onCreated: capture('created'),
      onDeterminingFilename: capture('determining'),
      cancel: vi.fn(async () => {}),
      erase: vi.fn(async () => {}),
    },
    tabs: { create: vi.fn(), update: vi.fn() },
    action: { onClicked: capture('action') },
  };
  return listeners;
}

async function boot() {
  const listeners = installChrome();
  vi.resetModules();
  await import('../src/background/service-worker.js');
  return listeners;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('service worker', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('redirects a navigation to a .eml file into the viewer', async () => {
    const on = await boot();
    on.navigate({ tabId: 7, frameId: 0, url: 'https://example.com/msg.eml' });

    expect(chrome.tabs.update).toHaveBeenCalledWith(7, {
      url: 'chrome-extension://abc/viewer.html?src=https%3A%2F%2Fexample.com%2Fmsg.eml',
    });
  });

  it('ignores navigations in subframes', async () => {
    const on = await boot();
    on.navigate({ tabId: 7, frameId: 1, url: 'https://example.com/msg.eml' });
    expect(chrome.tabs.update).not.toHaveBeenCalled();
  });

  it('intercepts a download declared as message/rfc822', async () => {
    const on = await boot();
    on.created({ id: 1, url: 'https://example.com/dl?id=7', mime: 'message/rfc822' });
    await settle();

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(1);
    expect(chrome.downloads.erase).toHaveBeenCalledWith({ id: 1 });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  // The .eml name often arrives only in Content-Disposition, which Chrome
  // resolves after onCreated. Such a download passes every check at creation
  // time and lands in the downloads list, where a click is handed to the OS and
  // no extension can intervene.
  it('intercepts a download whose .eml name only appears at filename determination', async () => {
    const on = await boot();
    const item = { id: 2, url: 'https://example.com/download?id=99', mime: 'application/octet-stream' };

    on.created(item);
    await settle();
    expect(chrome.tabs.create).not.toHaveBeenCalled();

    on.determining({ ...item, filename: 'quarterly-report.eml' }, () => {});
    await settle();

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(2);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('opens only one viewer tab when both checkpoints match the same download', async () => {
    const on = await boot();
    const item = { id: 3, url: 'https://example.com/msg.eml', mime: 'message/rfc822' };

    on.created(item);
    await settle();
    on.determining({ ...item, filename: 'msg.eml' }, () => {});
    await settle();

    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('never intercepts the viewer\'s own blob download', async () => {
    const on = await boot();
    on.determining({ id: 4, url: 'blob:chrome-extension://abc/1', filename: 'message.eml' }, () => {});
    await settle();

    expect(chrome.downloads.cancel).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('opens the viewer when the toolbar icon is clicked', async () => {
    const on = await boot();
    on.action();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://abc/viewer.html' });
  });
});
