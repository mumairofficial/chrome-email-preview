import { describe, it, expect } from 'vitest';
import { parseAuthResults } from '../src/lib/auth-results.js';

const header = (value) => [{ key: 'Authentication-Results', value }];

describe('parseAuthResults', () => {
  it('reports nothing when the header is absent', () => {
    const summary = parseAuthResults([{ key: 'Subject', value: 'hi' }]);
    expect(summary.checked).toBe(false);
    expect(summary.results).toEqual([]);
    expect(summary.hasFailure).toBe(false);
  });

  it('reads spf, dkim and dmarc results', () => {
    const summary = parseAuthResults(header('mx.example.com; spf=pass smtp.mailfrom=corp.com; dkim=pass header.d=corp.com; dmarc=pass header.from=corp.com'));
    expect(summary.results.map((r) => [r.method, r.result])).toEqual([
      ['spf', 'pass'],
      ['dkim', 'pass'],
      ['dmarc', 'pass'],
    ]);
    expect(summary.hasFailure).toBe(false);
  });

  it('extracts the domain each method was checked against', () => {
    const summary = parseAuthResults(header('spf=pass smtp.mailfrom=corp.com; dkim=pass header.d=mail.corp.com'));
    expect(summary.results.find((r) => r.method === 'spf').detail).toBe('corp.com');
    expect(summary.results.find((r) => r.method === 'dkim').detail).toBe('mail.corp.com');
  });

  it('flags a failure', () => {
    const summary = parseAuthResults(header('spf=fail smtp.mailfrom=spoof.example'));
    expect(summary.hasFailure).toBe(true);
  });

  it('treats softfail as a failure but neutral and none as not', () => {
    expect(parseAuthResults(header('spf=softfail')).hasFailure).toBe(true);
    expect(parseAuthResults(header('spf=neutral')).hasFailure).toBe(false);
    expect(parseAuthResults(header('dkim=none')).hasFailure).toBe(false);
  });

  it('keeps the topmost header when hops disagree', () => {
    const headers = [
      { key: 'Authentication-Results', value: 'spf=pass smtp.mailfrom=corp.com' },
      { key: 'Authentication-Results', value: 'spf=fail smtp.mailfrom=corp.com' },
    ];
    expect(parseAuthResults(headers).results[0].result).toBe('pass');
  });

  it('falls back to arc results', () => {
    const summary = parseAuthResults([{ key: 'ARC-Authentication-Results', value: 'i=1; spf=pass' }]);
    expect(summary.checked).toBe(true);
  });

  it('notes the presence of a dkim signature separately from its result', () => {
    const summary = parseAuthResults([{ key: 'DKIM-Signature', value: 'v=1; a=rsa-sha256' }]);
    expect(summary.signedByDkim).toBe(true);
    expect(summary.checked).toBe(false);
  });

  it('marks an unrecognised result rather than trusting it', () => {
    expect(parseAuthResults(header('spf=weirdvalue')).results[0].result).toBe('unknown');
  });
});
