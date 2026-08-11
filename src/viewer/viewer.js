import { parseEmail, EmailParseError } from '../lib/parse-email.js';
import { loadFromUrl, loadFromFile, SourceError } from '../lib/source-loader.js';
import {
  IFRAME_SANDBOX, FIND_MESSAGE_TYPE, FIND_RESULT_MESSAGE_TYPE,
} from '../lib/build-srcdoc.js';
import { buildMimeTree } from '../lib/mime-tree.js';
import { parseAuthResults } from '../lib/auth-results.js';
import { parseReceived } from '../lib/received.js';
import { extractLinks } from '../lib/links.js';
import { blockRemote } from '../lib/block-remote.js';
import { detectSecureMime } from '../lib/secure-mime.js';
import { parseIcs, isCalendarPart } from '../lib/ics.js';
import { renderStructure } from './ui/structure.js';
import { renderSecurity } from './ui/security.js';
import { renderEventCard } from './ui/event-card.js';
import { renderFindBar } from './ui/find-bar.js';
import { bindShortcuts } from './ui/shortcuts.js';
import { renderBody } from './render-pipeline.js';
import { renderHeaderCard } from './ui/header-card.js';
import { renderErrorCard } from './ui/error-card.js';
import { renderDropzone } from './ui/dropzone.js';
import { buildTabs, renderTabBar } from './ui/tabs.js';
import { renderHeaderInspector } from './ui/header-inspector.js';
import { renderAttachments } from './ui/attachments.js';
import { renderBanner } from './ui/banner.js';
import { renderAppBar } from './ui/app-bar.js';
import { renderShell, setRailOpen } from './ui/shell.js';
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
  railOpen: window.matchMedia?.('(min-width: 900px)')?.matches ?? true,
  findOpen: false,
  // Derived once per message rather than per render, since none of it changes
  // when the reader switches tabs.
  analysis: null,
};

function analyse() {
  const html = state.model.html ?? '';
  return {
    tree: buildMimeTree(state.rawText),
    auth: parseAuthResults(state.model.headers),
    trace: parseReceived(state.model.headers),
    links: extractLinks(html),
    blocked: blockRemote(html).blocked,
    secure: detectSecureMime(state.model),
    invite: calendarInvite(state.model),
  };
}

function calendarInvite(model) {
  const part = (model.attachments ?? []).find(isCalendarPart);
  if (!part) return null;
  const source = new TextDecoder('utf-8', { fatal: false }).decode(part.content);
  const event = parseIcs(source);
  return event ? { event, part } : null;
}

// How long to wait for the frame to answer before giving up on a search.
const FIND_TIMEOUT_MS = 300;

// The body sits in an opaque origin, so it can only be searched by asking it.
// Every other pane is ordinary DOM in this document.
function findInFrame({ query, backwards, fromStart }) {
  const frame = state.frame;
  if (!frame?.contentWindow) return Promise.resolve(false);

  return new Promise((resolve) => {
    const settle = (found) => {
      clearTimeout(timer);
      window.removeEventListener('message', onReply);
      resolve(found);
    };
    const onReply = (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type !== FIND_RESULT_MESSAGE_TYPE) return;
      settle(Boolean(event.data.found));
    };

    window.addEventListener('message', onReply);
    const timer = setTimeout(() => settle(false), FIND_TIMEOUT_MS);
    frame.contentWindow.postMessage({ type: FIND_MESSAGE_TYPE, query, backwards, fromStart }, '*');
  });
}

function findInMessage(request) {
  if (state.frame) return findInFrame(request);
  if (request.fromStart) window.getSelection()?.removeAllRanges();
  return Promise.resolve(window.find?.(request.query, false, Boolean(request.backwards), true) ?? false);
}

function toggleFind(open) {
  state.findOpen = open ?? !state.findOpen;
  renderMessage();
  if (state.findOpen) app.querySelector('.find-bar')?.focusInput();
}

function clear() {
  state.frame = null;
  app.replaceChildren();
}

function showError({ title, detail, actionLabel, onAction }) {
  clear();
  app.classList.add('app--empty');
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
  return { node: frame, blockedCount };
}

function renderPane() {
  if (state.activeTab === 'headers') {
    return { node: renderHeaderInspector(state.model), blockedCount: 0 };
  }
  if (state.activeTab === 'structure') {
    return { node: renderStructure(state.analysis.tree), blockedCount: 0 };
  }
  if (state.activeTab === 'security') {
    return { node: renderSecurity(state.analysis), blockedCount: 0 };
  }
  if (state.activeTab === 'text' || state.activeTab === 'raw') {
    const pre = document.createElement('pre');
    pre.className = 'plain-pane';
    pre.textContent = state.activeTab === 'text' ? state.model.text : state.rawText;
    return { node: pre, blockedCount: 0 };
  }
  return bodyFrame();
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

function tabAlerts() {
  const { auth, links, blocked } = state.analysis;
  const problems = [];
  if (auth.hasFailure) problems.push('authentication failed');
  const suspicious = links.filter((l) => l.mismatch || l.punycode).length;
  if (suspicious) problems.push(`${suspicious} disguised ${suspicious === 1 ? 'link' : 'links'}`);
  const trackers = blocked.filter((b) => b.tracker).length;
  if (trackers) problems.push(`${trackers} tracking ${trackers === 1 ? 'pixel' : 'pixels'}`);

  return problems.length ? { security: problems.join(', ') } : {};
}

function secureMimeNotice() {
  const { signed, encrypted, scheme } = state.analysis.secure;
  if (!signed && !encrypted) return null;

  const notice = document.createElement('aside');
  notice.className = 'banner banner--info';
  notice.textContent = encrypted
    ? `This message is ${scheme} encrypted. EML Preview does not decrypt it, so the body below may be unreadable.`
    : `This message carries a ${scheme} signature. It is shown, not verified.`;
  return notice;
}

function downloadPart(part) {
  const url = URL.createObjectURL(new Blob([part.content], { type: part.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = part.filename || 'invite.ics';
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
  app.classList.remove('app--empty');
  state.frame = pane.node.tagName === 'IFRAME' ? pane.node : null;

  const shell = renderShell();
  setRailOpen(shell.root, state.railOpen);

  // Toggling the rail deliberately does not re-render: rebuilding the shell
  // would recreate the iframe and throw away the reader's scroll position.
  const { bar, toggle } = renderAppBar({
    subject: state.model.subject,
    onDownload: downloadOriginal,
    railOpen: state.railOpen,
    onToggleRail: () => {
      state.railOpen = !state.railOpen;
      setRailOpen(shell.root, state.railOpen);
      toggle.setAttribute('aria-expanded', String(state.railOpen));
    },
  });
  shell.appbar.append(bar);

  shell.tabs.append(
    renderTabBar(tabs, state.activeTab, (id) => {
      state.activeTab = id;
      renderMessage();
    }, { alerts: tabAlerts() })
  );

  if (state.findOpen) {
    shell.banner.append(renderFindBar({
      onSearch: findInMessage,
      onClose: () => toggleFind(false),
    }));
  }

  const secureNotice = secureMimeNotice();
  if (secureNotice) shell.banner.append(secureNotice);

  if (state.analysis.invite) {
    shell.banner.append(renderEventCard(state.analysis.invite.event, {
      onDownload: () => downloadPart(state.analysis.invite.part),
    }));
  }

  const banner = renderBanner(pane.blockedCount, () => {
    state.allowRemoteImages = true;
    renderMessage();
  });
  if (banner) shell.banner.append(banner);

  shell.pane.append(pane.node);

  shell.rail.append(renderHeaderCard(state.model));

  const strip = renderAttachments(state.model.attachments, {
    onOpenNested: (att) => openBytes(att.content, att.filename),
  });
  if (strip) shell.rail.append(strip);

  app.append(shell.root);
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
  state.analysis = analyse();
  state.activeTab = state.model.html ? 'html' : state.model.text ? 'text' : 'raw';
  state.findOpen = false;
  renderMessage();
}

function showPicker() {
  clear();
  app.classList.add('app--empty');
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

bindShortcuts({
  onFind: () => {
    if (!state.model) return;
    if (state.findOpen) app.querySelector('.find-bar')?.focusInput();
    else toggleFind(true);
  },
  onEscape: () => {
    if (state.findOpen) toggleFind(false);
  },
  onTab: (index) => {
    if (!state.model) return;
    const tab = buildTabs(state.model)[index];
    if (!tab?.enabled || tab.id === state.activeTab) return;
    state.activeTab = tab.id;
    renderMessage();
  },
  onDownload: () => {
    if (state.model) downloadOriginal();
  },
  onToggleRail: () => {
    if (!state.model) return;
    state.railOpen = !state.railOpen;
    renderMessage();
  },
});

const src = new URLSearchParams(location.search).get('src');
if (src) {
  openUrl(src);
} else {
  showPicker();
}
