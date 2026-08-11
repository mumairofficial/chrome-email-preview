// Material Symbols paths, drawn on the 960-unit grid they ship on.
// Everything renders with fill="currentColor" so a single asset follows the
// page's light or dark theme instead of needing a second copy.
const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  mailRead:
    'M638-80 468-250l56-56 114 114 226-226 56 56L638-80ZM480-520l320-200H160l320 200Zm0 80L160-640v400h206l80 80H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v174l-80 80v-174L480-440Zm0 0Zm0-80Zm0 80Z',
  menuOpen:
    'M120-240v-80h520v80H120Zm664-40L584-480l200-200 56 56-144 144 144 144-56 56ZM120-440v-80h400v80H120Zm0-200v-80h520v80H120Z',
};

export function renderIcon(name, { size = 20, className = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 -960 960 960');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  if (className) svg.classList.add(className);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name]);
  svg.append(path);

  return svg;
}

export { PATHS };
