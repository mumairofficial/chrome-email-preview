export function buildTabs(model) {
  return [
    { id: 'html', label: 'HTML', enabled: Boolean(model.html) },
    { id: 'text', label: 'Text', enabled: Boolean(model.text) },
    { id: 'raw', label: 'Raw', enabled: true },
    { id: 'headers', label: 'Headers', enabled: true },
  ];
}

export function renderTabBar(tabs, activeId, onSelect) {
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.setAttribute('role', 'tablist');

  for (const tab of tabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tabId = tab.id;
    button.textContent = tab.label;
    button.disabled = !tab.enabled;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.id === activeId));
    button.addEventListener('click', () => onSelect(tab.id));
    bar.append(button);
  }
  return bar;
}
