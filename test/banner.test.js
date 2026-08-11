import { describe, it, expect } from 'vitest';
import { renderBanner } from '../src/viewer/ui/banner.js';

describe('renderBanner', () => {
  it('renders nothing when nothing was blocked', () => {
    expect(renderBanner(0, () => {})).toBeNull();
  });

  it('uses singular wording for one blocked resource', () => {
    expect(renderBanner(1, () => {}).textContent).toContain('1 remote resource blocked');
  });

  it('uses plural wording for several', () => {
    expect(renderBanner(4, () => {}).textContent).toContain('4 remote resources blocked');
  });

  it('calls back when the load button is clicked', () => {
    let calls = 0;
    renderBanner(2, () => { calls += 1; }).querySelector('button').click();
    expect(calls).toBe(1);
  });
});
