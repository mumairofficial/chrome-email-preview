import { describe, it, expect } from 'vitest';
import { buildTabs, renderTabBar } from '../src/viewer/ui/tabs.js';

describe('buildTabs', () => {
  it('always offers four tabs in a fixed order', () => {
    const tabs = buildTabs({ html: '<p>x</p>', text: 'x', headers: [] });
    expect(tabs.map((t) => t.id)).toEqual(['html', 'text', 'raw', 'headers']);
  });

  it('disables html when there is no html part', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    expect(tabs.find((t) => t.id === 'html').enabled).toBe(false);
    expect(tabs.find((t) => t.id === 'text').enabled).toBe(true);
  });

  it('disables text when there is no plain part', () => {
    const tabs = buildTabs({ html: '<p>x</p>', text: null, headers: [] });
    expect(tabs.find((t) => t.id === 'text').enabled).toBe(false);
  });

  it('always enables raw and headers', () => {
    const tabs = buildTabs({ html: null, text: null, headers: [] });
    expect(tabs.find((t) => t.id === 'raw').enabled).toBe(true);
    expect(tabs.find((t) => t.id === 'headers').enabled).toBe(true);
  });
});

describe('renderTabBar', () => {
  it('marks the active tab and disables unavailable ones', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    const bar = renderTabBar(tabs, 'text', () => {});
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.find((b) => b.dataset.tabId === 'html').disabled).toBe(true);
    expect(buttons.find((b) => b.dataset.tabId === 'text').getAttribute('aria-selected')).toBe('true');
  });

  it('reports selection and ignores disabled tabs', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    const chosen = [];
    const bar = renderTabBar(tabs, 'text', (id) => chosen.push(id));
    bar.querySelector('[data-tab-id="raw"]').click();
    bar.querySelector('[data-tab-id="html"]').click();
    expect(chosen).toEqual(['raw']);
  });
});
