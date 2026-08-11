import { formatAddress, formatAddressList, formatDate } from '../format.js';

function row(label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

export function renderHeaderCard(model) {
  const card = document.createElement('section');
  card.className = 'rail__section header-card';

  const heading = document.createElement('h2');
  heading.className = 'rail__title';
  heading.textContent = 'Details';
  card.append(heading);

  const dl = document.createElement('dl');
  dl.className = 'header-card__fields';

  const fields = [
    ['From', formatAddress(model.from)],
    ['To', formatAddressList(model.to)],
    ['Cc', formatAddressList(model.cc)],
    ['Date', formatDate(model.date)],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    dl.append(...row(label, value));
  }

  card.append(dl);
  return card;
}
