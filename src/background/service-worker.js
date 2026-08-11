import { isEmlUrl, shouldInterceptDownload, viewerUrlFor } from './intercept-rules.js';

const viewerPath = () => chrome.runtime.getURL('viewer.html');

// A download is offered to us twice: at creation, and again once Chrome has
// resolved the filename. Both can match, so remember what has been handled.
// Ids are per-session and downloads are few, so this never grows meaningfully.
const handled = new Set();

async function openInViewer(item) {
  if (handled.has(item.id)) return;
  handled.add(item.id);

  try {
    await chrome.downloads.cancel(item.id);
    await chrome.downloads.erase({ id: item.id });
  } catch {
    // The download may already have finished; opening the viewer is still correct.
  }
  chrome.tabs.create({ url: viewerUrlFor(item.finalUrl || item.url, viewerPath()) });
}

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId, url }) => {
  if (frameId !== 0) return;
  if (!isEmlUrl(url)) return;
  chrome.tabs.update(tabId, { url: viewerUrlFor(url, viewerPath()) });
});

chrome.downloads.onCreated.addListener((item) => {
  if (!shouldInterceptDownload(item)) return;
  openInViewer(item);
});

// WHY A SECOND CHECKPOINT: at onCreated the filename is not yet resolved, so a
// server that sends application/octet-stream from a URL with no .eml in it —
// naming the file only in Content-Disposition — passes every check and lands in
// the downloads list. Clicking it there is handed to the operating system, and
// no extension API observes that click, so this is the last chance to catch it.
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (!shouldInterceptDownload(item)) return;
  openInViewer(item);
  // Not calling suggest() leaves Chrome's default naming in place, which is
  // moot for a download we are cancelling.
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: viewerPath() });
});
