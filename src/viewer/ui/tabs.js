export function buildTabs(model) {
  return [
    { id: 'html', label: 'HTML', enabled: Boolean(model.html) },
    { id: 'text', label: 'Text', enabled: Boolean(model.text) },
    { id: 'raw', label: 'Raw', enabled: true },
    { id: 'headers', label: 'Headers', enabled: true },
    { id: 'structure', label: 'Structure', enabled: true },
    { id: 'security', label: 'Security', enabled: true },
  ];
}

export function renderTabBar(tabs, activeId, onSelect, { alerts = {} } = {}) {
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

    // A tab can carry a warning dot so a problem is visible without opening it.
    if (alerts[tab.id]) {
      const dot = document.createElement('span');
      dot.className = 'tabbar__alert';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '●';
      button.append(dot);
      button.title = alerts[tab.id];
    }

    button.addEventListener('click', () => onSelect(tab.id));
    bar.append(button);
  }
  return bar;
}
