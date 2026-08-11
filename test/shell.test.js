import { describe, it, expect } from 'vitest';
import { renderShell, setRailOpen, RAIL_ID } from '../src/viewer/ui/shell.js';

describe('renderShell', () => {
  it('exposes every slot as a distinct element inside the root', () => {
    const shell = renderShell();
    const slots = [shell.appbar, shell.main, shell.tabs, shell.banner, shell.pane, shell.rail];

    expect(new Set(slots).size).toBe(slots.length);
    for (const slot of slots) expect(shell.root.contains(slot)).toBe(true);
  });

  it('nests the tabs, banner and pane inside main', () => {
    const shell = renderShell();
    for (const slot of [shell.tabs, shell.banner, shell.pane]) {
      expect(slot.parentElement).toBe(shell.main);
    }
    expect(shell.rail.parentElement).toBe(shell.root);
  });

  it('gives the rail the id the app bar toggle points at', () => {
    expect(renderShell().rail.id).toBe(RAIL_ID);
  });

  it('starts with every slot empty for the caller to fill', () => {
    const shell = renderShell();
    for (const slot of [shell.appbar, shell.tabs, shell.banner, shell.pane, shell.rail]) {
      expect(slot.childElementCount).toBe(0);
    }
  });
});

describe('setRailOpen', () => {
  it('toggles the open class in both directions', () => {
    const { root } = renderShell();

    setRailOpen(root, true);
    expect(root.classList.contains('shell--rail-open')).toBe(true);

    setRailOpen(root, false);
    expect(root.classList.contains('shell--rail-open')).toBe(false);
  });
});
