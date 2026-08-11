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

const app = document.getElementById('app');

const state = {
  model: null,
  bytes: null,
  source: null,
  rawText: '',
  activeTab: 'html',
  allowRemoteImages: false,
};

function clear() {
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

  const { srcdoc } = renderBody(state.model, {
    allowRemoteImages: state.allowRemoteImages,
    nonce: crypto.randomUUID(),
  });
  frame.srcdoc = srcdoc;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type !== HEIGHT_MESSAGE_TYPE) return;
    frame.style.height = `${event.data.height}px`;
  });

  return frame;
}

function renderPane() {
  if (state.activeTab === 'headers') return renderHeaderInspector(state.model);

  if (state.activeTab === 'text' || state.activeTab === 'raw') {
    const pre = document.createElement('pre');
    pre.className = 'plain-pane';
    pre.textContent = state.activeTab === 'text' ? state.model.text : state.rawText;
    return pre;
  }
  return bodyFrame();
}

function renderMessage() {
  const tabs = buildTabs(state.model);
  if (!tabs.find((t) => t.id === state.activeTab)?.enabled) {
    state.activeTab = tabs.find((t) => t.enabled).id;
  }

  clear();
  app.append(
    renderHeaderCard(state.model),
    renderTabBar(tabs, state.activeTab, (id) => {
      state.activeTab = id;
      renderMessage();
    }),
    renderPane()
  );

  const strip = renderAttachments(state.model.attachments, {
    onOpenNested: (att) => openBytes(att.content, att.filename),
  });
  if (strip) app.append(strip);
}

async function openBytes(bytes, source) {
  state.bytes = bytes;
  state.source = source;
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
