export function renderBanner(blockedCount, onLoad) {
  if (!blockedCount) return null;

  const bar = document.createElement('aside');
  bar.className = 'banner';

  const text = document.createElement('span');
  const noun = blockedCount === 1 ? 'resource' : 'resources';
  text.textContent = `${blockedCount} remote ${noun} blocked to protect your privacy.`;
  bar.append(text);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Load remote content';
  button.addEventListener('click', onLoad);
  bar.append(button);

  return bar;
}
