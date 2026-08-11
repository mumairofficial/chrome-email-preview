import { parseEmail, EmailParseError } from '../lib/parse-email.js';
import { loadFromUrl, loadFromFile, SourceError } from '../lib/source-loader.js';
import { IFRAME_SANDBOX, HEIGHT_MESSAGE_TYPE } from '../lib/build-srcdoc.js';
import { renderBody } from './render-pipeline.js';
import { renderHeaderCard } from './ui/header-card.js';
import { renderErrorCard } from './ui/error-card.js';
import { renderDropzone } from './ui/dropzone.js';
import { buildTabs, renderTabBar } from './ui/tabs.js';
import { renderHeaderInspector } from './ui/header-inspector.js';
import { renderAttachments } from './ui/attachments.js';
import { renderBanner } from './ui/banner.js';
import { renderToolbar } from './ui/toolbar.js';
import { hasHostPermission, requestHostPermission } from './host-permission.js';

const app = document.getElementById('app');

const state = {
  model: null,
  bytes: null,
  source: null,
  rawText: '',
  activeTab: 'html',
  allowRemoteImages: false,
  frame: null,
};

// One listener for the lifetime of the page. Registering it per render would
// leak a listener on every tab switch and every remote-content toggle.
window.addEventListener('message', (event) => {
  if (!state.frame || event.source !== state.frame.contentWindow) return;
  if (event.data?.type !== HEIGHT_MESSAGE_TYPE) return;
  state.frame.style.height = `${event.data.height}px`;
});

function clear() {
  state.frame = null;
  app.replaceChildren();
}

function showError({ title, detail, actionLabel, onAction }) {
  clear();
  app.append(renderErrorCard({ title, detail, actionLabel, onAction }));
}

function bodyFrame() {
  const frame = document.createElement('iframe');
  frame.className = 'body-frame';
  frame.setAttribute('sandbox', IFRAME_SANDBOX);
  frame.setAttribute('title', 'Message body');

  const { srcdoc, blockedCount } = renderBody(state.model, {
    allowRemoteImages: state.allowRemoteImages,
    nonce: crypto.randomUUID(),
  });
  frame.srcdoc = srcdoc;
  state.frame = frame;

  return { frame, blockedCount };
}

function renderPane() {
  if (state.activeTab === 'headers') {
    return { node: renderHeaderInspector(state.model), blockedCount: 0 };
  }
  if (state.activeTab === 'text' || state.activeTab === 'raw') {
    const pre = document.createElement('pre');
    pre.className = 'plain-pane';
    pre.textContent = state.activeTab === 'text' ? state.model.text : state.rawText;
    return { node: pre, blockedCount: 0 };
  }
  const { frame, blockedCount } = bodyFrame();
  return { node: frame, blockedCount };
}

function filenameFor(source) {
  if (!source) return 'message.eml';
  const last = source.split('/').pop().split('?')[0];
  return last || 'message.eml';
}

function downloadOriginal() {
  const url = URL.createObjectURL(new Blob([state.bytes], { type: 'message/rfc822' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFor(state.source);
  a.click();
  URL.revokeObjectURL(url);
}

function renderMessage() {
  const tabs = buildTabs(state.model);
  if (!tabs.find((t) => t.id === state.activeTab)?.enabled) {
    state.activeTab = tabs.find((t) => t.enabled).id;
  }

  const pane = renderPane();

  clear();
  state.frame = pane.node.tagName === 'IFRAME' ? pane.node : null;

  app.append(
    renderToolbar({ onPrint: () => window.print(), onDownload: downloadOriginal }),
    renderHeaderCard(state.model),
    renderTabBar(tabs, state.activeTab, (id) => {
      state.activeTab = id;
      renderMessage();
    })
  );

  const banner = renderBanner(pane.blockedCount, () => {
    state.allowRemoteImages = true;
    renderMessage();
  });
  if (banner) app.append(banner);

  app.append(pane.node);

  const strip = renderAttachments(state.model.attachments, {
    onOpenNested: (att) => openBytes(att.content, att.filename),
  });
  if (strip) app.append(strip);
}

async function openBytes(bytes, source) {
  state.bytes = bytes;
  state.source = source;
  state.allowRemoteImages = false;
  try {
    state.model = await parseEmail(bytes);
  } catch (error) {
    if (error instanceof EmailParseError) {
      showError({
        title: 'Not a readable email',
        detail: 'This file could not be parsed as an RFC 822 message.',
      });
      return;
    }
    throw error;
  }
  state.rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  state.activeTab = state.model.html ? 'html' : state.model.text ? 'text' : 'raw';
  renderMessage();
}

function showPicker() {
  clear();
  app.append(renderDropzone(async (file) => {
    openBytes(await loadFromFile(file), file.name);
  }));
}

async function openUrl(src) {
  if (!(await hasHostPermission(src))) {
    showError({
      title: 'Permission needed',
      detail: `EML Preview needs permission to read messages from ${new URL(src).host}.`,
      actionLabel: 'Grant access',
      onAction: async () => {
        if (await requestHostPermission(src)) openUrl(src);
      },
    });
    return;
  }

  try {
    await openBytes(await loadFromUrl(src), src);
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    if (error.kind === 'file-access-denied') {
      showError({
        title: 'Chrome blocked access to this file',
        detail:
          'Open chrome://extensions, click Details on EML Preview, and turn on ' +
          '"Allow access to file URLs". Then reload this tab.',
      });
      return;
    }
    showError({ title: 'Could not load this message', detail: `${error.message} (${src})` });
  }
}

const src = new URLSearchParams(location.search).get('src');
if (src) {
  openUrl(src);
} else {
  showPicker();
}
