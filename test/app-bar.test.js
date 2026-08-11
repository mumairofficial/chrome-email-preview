import { describe, it, expect } from 'vitest';
import { renderAppBar } from '../src/viewer/ui/app-bar.js';
import { RAIL_ID } from '../src/viewer/ui/shell.js';

const noop = () => {};
const handlers = { onDownload: noop, onToggleRail: noop };

describe('renderAppBar', () => {
  it('shows the subject', () => {
    const { bar } = renderAppBar({ subject: 'Quarterly report', ...handlers });
    expect(bar.querySelector('.app-bar__subject').textContent).toBe('Quarterly report');
  });

  it('keeps the full subject reachable in a title, since the heading is clipped', () => {
    const subject = 'A subject far too long to sit on one line in the app bar';
    const { bar } = renderAppBar({ subject, ...handlers });
    expect(bar.querySelector('.app-bar__subject').title).toBe(subject);
  });

  it('uses a placeholder when the subject is empty', () => {
    const { bar } = renderAppBar({ subject: '', ...handlers });
    expect(bar.textContent).toContain('(no subject)');
  });

  it('escapes the subject rather than interpreting it as html', () => {
    const { bar } = renderAppBar({ subject: '<img src=x onerror=alert(1)>', ...handlers });
    expect(bar.querySelectorAll('img')).toHaveLength(0);
    expect(bar.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('offers download and details actions', () => {
    const { bar } = renderAppBar({ subject: 'x', ...handlers });
    const labels = [...bar.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Download original', 'Details']);
  });

  it('invokes each handler', () => {
    const calls = [];
    const { bar } = renderAppBar({
      subject: 'x',
      onDownload: () => calls.push('download'),
      onToggleRail: () => calls.push('toggle'),
    });
    for (const b of bar.querySelectorAll('button')) b.click();
    expect(calls).toEqual(['download', 'toggle']);
  });

  it('reflects the rail state on the toggle', () => {
    const open = renderAppBar({ subject: 'x', railOpen: true, ...handlers });
    expect(open.toggle.getAttribute('aria-expanded')).toBe('true');
    expect(open.toggle.getAttribute('aria-controls')).toBe(RAIL_ID);

    const closed = renderAppBar({ subject: 'x', railOpen: false, ...handlers });
    expect(closed.toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
