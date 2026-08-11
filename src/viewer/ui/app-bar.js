import { RAIL_ID } from './shell.js';
import { renderIcon } from './icons.js';

function action(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

// The label stays in the DOM for screen readers and for tests, but is clipped
// visually so the control reads as an icon.
function iconAction(name, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.append(renderIcon(name));

  const text = document.createElement('span');
  text.className = 'visually-hidden';
  text.textContent = label;
  button.append(text);

  button.title = label;
  button.addEventListener('click', onClick);
  return button;
}

export function renderAppBar({ subject, onDownload, onToggleRail, railOpen = true }) {
  const bar = document.createElement('div');
  bar.className = 'app-bar';

  const glyph = renderIcon('mailRead', { size: 22, className: 'app-bar__glyph' });

  const text = subject || '(no subject)';
  const heading = document.createElement('h1');
  heading.className = 'app-bar__subject';
  heading.textContent = text;
  // The heading is clipped to one line, so the full subject has to stay
  // reachable somewhere.
  heading.title = text;

  const actions = document.createElement('div');
  actions.className = 'app-bar__actions';

  const toggle = iconAction('menuOpen', 'Details', onToggleRail);
  toggle.className = 'app-bar__toggle';
  toggle.setAttribute('aria-expanded', String(railOpen));
  toggle.setAttribute('aria-controls', RAIL_ID);

  actions.append(action('Download original', onDownload), toggle);

  bar.append(glyph, heading, actions);
  return { bar, toggle };
}
