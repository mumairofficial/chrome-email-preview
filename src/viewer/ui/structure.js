import { formatBytes } from '../format.js';
import { flattenTree } from '../../lib/mime-tree.js';

function label(node) {
  if (node.filename) return node.filename;
  if (node.disposition === 'inline' && node.contentId) return `cid:${node.contentId}`;
  return '';
}

function tag(text, kind) {
  const span = document.createElement('span');
  span.className = `part__tag part__tag--${kind}`;
  span.textContent = text;
  return span;
}

function renderNode(node) {
  const row = document.createElement('li');
  row.className = 'part';
  row.style.setProperty('--depth', String(node.depth));
  if (node.children.length) row.classList.add('part--container');

  const type = document.createElement('span');
  type.className = 'part__type';
  type.textContent = node.type;
  row.append(type);

  const name = label(node);
  if (name) {
    const named = document.createElement('span');
    named.className = 'part__name';
    named.textContent = name;
    row.append(named);
  }

  if (node.charset) row.append(tag(node.charset, 'charset'));
  if (node.encoding && node.encoding !== '7bit') row.append(tag(node.encoding, 'encoding'));

  const size = document.createElement('span');
  size.className = 'part__size';
  size.textContent = formatBytes(node.size);
  row.append(size);

  return row;
}

export function renderStructure(tree) {
  const section = document.createElement('section');
  section.className = 'structure';

  if (!tree) {
    const empty = document.createElement('p');
    empty.textContent = 'The MIME structure of this message could not be read.';
    section.append(empty);
    return section;
  }

  const nodes = flattenTree(tree);

  const summary = document.createElement('p');
  summary.className = 'structure__summary';
  const noun = nodes.length === 1 ? 'part' : 'parts';
  summary.textContent = `${nodes.length} ${noun}`;
  section.append(summary);

  const list = document.createElement('ul');
  list.className = 'structure__list';
  for (const node of nodes) list.append(renderNode(node));
  section.append(list);

  return section;
}
