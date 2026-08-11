import { describe, it, expect } from 'vitest';
import { renderHeaderCard } from '../src/viewer/ui/header-card.js';
import { renderErrorCard } from '../src/viewer/ui/error-card.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

describe('renderHeaderCard', () => {
  it('shows subject, from, to and date', async () => {
    const el = renderHeaderCard(await parseEmail(await loadFixture('plain-text.eml')));
    expect(el.textContent).toContain('Plain text hello');
    expect(el.textContent).toContain('Alice <alice@example.com>');
    expect(el.textContent).toContain('bob@example.com');
    expect(el.textContent).toMatch(/2026/);
  });

  it('omits rows that have no value', async () => {
    const el = renderHeaderCard(await parseEmail(await loadFixture('plain-text.eml')));
    expect(el.textContent).not.toContain('Cc');
  });

  it('uses a placeholder when the subject is empty', () => {
    const el = renderHeaderCard({ subject: '', from: null, to: [], cc: [], date: '' });
    expect(el.textContent).toContain('(no subject)');
  });

  it('escapes header values rather than interpreting them as html', () => {
    const el = renderHeaderCard({ subject: '<img src=x onerror=alert(1)>', from: null, to: [], cc: [], date: '' });
    expect(el.querySelectorAll('img')).toHaveLength(0);
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('renderErrorCard', () => {
  it('shows the title and detail', () => {
    const el = renderErrorCard({ title: 'Nope', detail: 'because reasons' });
    expect(el.textContent).toContain('Nope');
    expect(el.textContent).toContain('because reasons');
  });

  it('wires the action button when one is given', () => {
    let clicked = 0;
    const el = renderErrorCard({ title: 'X', detail: 'y', actionLabel: 'Retry', onAction: () => { clicked += 1; } });
    el.querySelector('button').click();
    expect(clicked).toBe(1);
  });

  it('renders no button when no action is given', () => {
    expect(renderErrorCard({ title: 'X', detail: 'y' }).querySelector('button')).toBeNull();
  });
});
