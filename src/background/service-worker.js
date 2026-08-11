import { isEmlUrl, shouldInterceptDownload, viewerUrlFor } from './intercept-rules.js';

const viewerPath = () => chrome.runtime.getURL('viewer.html');

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId, url }) => {
  if (frameId !== 0) return;
  if (!isEmlUrl(url)) return;
  chrome.tabs.update(tabId, { url: viewerUrlFor(url, viewerPath()) });
});

chrome.downloads.onCreated.addListener(async (item) => {
  if (!shouldInterceptDownload(item)) return;
  try {
    await chrome.downloads.cancel(item.id);
    await chrome.downloads.erase({ id: item.id });
  } catch {
    // The download may already have finished; opening the viewer is still correct.
  }
  chrome.tabs.create({ url: viewerUrlFor(item.finalUrl || item.url, viewerPath()) });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: viewerPath() });
});
