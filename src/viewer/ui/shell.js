export const RAIL_ID = 'details-rail';

// The skeleton knows nothing about messages. It hands back empty slots and the
// caller fills them, so the layout lives in one place instead of being implied
// by the order of appends in viewer.js.
export function renderShell() {
  const root = document.createElement('div');
  root.className = 'shell';

  const appbar = document.createElement('header');
  appbar.className = 'shell__appbar';

  const main = document.createElement('div');
  main.className = 'shell__main';

  const tabs = document.createElement('div');
  tabs.className = 'shell__tabs';

  const banner = document.createElement('div');
  banner.className = 'shell__banner';

  const pane = document.createElement('div');
  pane.className = 'shell__pane';

  const rail = document.createElement('aside');
  rail.className = 'shell__rail';
  rail.id = RAIL_ID;
  rail.setAttribute('aria-label', 'Message details');

  main.append(tabs, banner, pane);
  root.append(appbar, main, rail);

  return { root, appbar, main, tabs, banner, pane, rail };
}

export function setRailOpen(root, open) {
  root.classList.toggle('shell--rail-open', open);
}
