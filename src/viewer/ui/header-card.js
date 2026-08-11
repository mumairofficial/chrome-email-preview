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
  card.className = 'header-card';

  const subject = document.createElement('h1');
  subject.className = 'header-card__subject';
  subject.textContent = model.subject || '(no subject)';
  card.append(subject);

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
