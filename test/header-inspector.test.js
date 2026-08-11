import { describe, it, expect } from 'vitest';
import { renderHeaderInspector } from '../src/viewer/ui/header-inspector.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

describe('renderHeaderInspector', () => {
  it('lists every header in file order', async () => {
    const model = await parseEmail(await loadFixture('plain-text.eml'));
    const el = renderHeaderInspector(model);
    const keys = [...el.querySelectorAll('th')].map((th) => th.textContent.toLowerCase());
    expect(keys).toContain('subject');
    expect(keys).toContain('message-id');
    expect(keys.length).toBe(model.headers.length);
  });

  it('renders values as text, never as markup', () => {
    const el = renderHeaderInspector({ headers: [{ key: 'X-Evil', value: '<img src=x onerror=alert(1)>' }] });
    expect(el.querySelectorAll('img')).toHaveLength(0);
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('says so when there are no headers', () => {
    expect(renderHeaderInspector({ headers: [] }).textContent).toContain('No headers');
  });
});
