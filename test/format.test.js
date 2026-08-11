import { describe, it, expect } from 'vitest';
import { formatAddress, formatAddressList, formatBytes, formatDate } from '../src/viewer/format.js';

describe('formatAddress', () => {
  it('renders name and address, or address alone', () => {
    expect(formatAddress({ name: 'Alice', address: 'a@b.c' })).toBe('Alice <a@b.c>');
    expect(formatAddress({ name: '', address: 'a@b.c' })).toBe('a@b.c');
    expect(formatAddress(null)).toBe('');
  });
});

describe('formatAddressList', () => {
  it('joins with commas and tolerates empty input', () => {
    expect(formatAddressList([{ address: 'a@b.c' }, { name: 'D', address: 'd@e.f' }]))
      .toBe('a@b.c, D <d@e.f>');
    expect(formatAddressList([])).toBe('');
    expect(formatAddressList(undefined)).toBe('');
  });
});

describe('formatBytes', () => {
  it('scales to a readable unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatDate', () => {
  it('returns a readable string and passes junk through', () => {
    expect(formatDate('2026-08-10T09:00:00.000Z')).toMatch(/2026/);
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('not a date');
  });
});
