import { describe, it, expect } from 'vitest';
import { renderToolbar } from '../src/viewer/ui/toolbar.js';

describe('renderToolbar', () => {
  it('offers print and download actions', () => {
    const el = renderToolbar({ onPrint: () => {}, onDownload: () => {} });
    const labels = [...el.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Print / Save as PDF', 'Download original']);
  });

  it('invokes each handler', () => {
    const calls = [];
    const el = renderToolbar({
      onPrint: () => calls.push('print'),
      onDownload: () => calls.push('download'),
    });
    for (const b of el.querySelectorAll('button')) b.click();
    expect(calls).toEqual(['print', 'download']);
  });
});
