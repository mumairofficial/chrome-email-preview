export function renderErrorCard({ title, detail, actionLabel, onAction }) {
  const card = document.createElement('section');
  card.className = 'error-card';

  const h = document.createElement('h2');
  h.textContent = title;
  card.append(h);

  const p = document.createElement('p');
  p.textContent = detail;
  card.append(p);

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    card.append(button);
  }
  return card;
}
