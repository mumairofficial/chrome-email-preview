export function renderFindBar({ onSearch, onClose }) {
  const bar = document.createElement('div');
  bar.className = 'find-bar';
  bar.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'find-bar__input';
  input.placeholder = 'Find in message';
  input.setAttribute('aria-label', 'Find in message');

  const status = document.createElement('span');
  status.className = 'find-bar__status';

  const setStatus = (text, missing) => {
    status.textContent = text;
    bar.classList.toggle('find-bar--missing', Boolean(missing));
  };

  const search = async (backwards) => {
    const query = input.value.trim();
    if (!query) return setStatus('');
    const found = await onSearch({ query, backwards, fromStart: false });
    setStatus(found ? '' : 'No matches', !found);
  };

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.textContent = '↑';
  prev.title = 'Previous match';
  prev.addEventListener('click', () => search(true));

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = '↓';
  next.title = 'Next match';
  next.addEventListener('click', () => search(false));

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.title = 'Close find';
  close.addEventListener('click', onClose);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      search(event.shiftKey);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  });

  // Typing restarts from the top so results track what is on screen.
  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (!query) return setStatus('');
    const found = await onSearch({ query, backwards: false, fromStart: true });
    setStatus(found ? '' : 'No matches', !found);
  });

  bar.append(input, status, prev, next, close);
  bar.focusInput = () => {
    input.focus();
    input.select();
  };
  return bar;
}
