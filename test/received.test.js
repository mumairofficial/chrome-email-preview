import { describe, it, expect } from 'vitest';
import { parseReceived } from '../src/lib/received.js';

const hop = (value) => ({ key: 'Received', value });

describe('parseReceived', () => {
  it('returns nothing when there are no received headers', () => {
    const trace = parseReceived([{ key: 'Subject', value: 'hi' }]);
    expect(trace.hops).toEqual([]);
    expect(trace.totalSeconds).toBe(0);
  });

  it('orders hops oldest first, reversing header order', () => {
    const trace = parseReceived([
      hop('from b.example by c.example; Mon, 10 Aug 2026 09:00:20 +0000'),
      hop('from a.example by b.example; Mon, 10 Aug 2026 09:00:05 +0000'),
    ]);
    expect(trace.hops.map((h) => h.by)).toEqual(['b.example', 'c.example']);
  });

  it('extracts from, by and with', () => {
    const trace = parseReceived([
      hop('from mail.corp.com by mx.example.com with ESMTPS; Mon, 10 Aug 2026 09:00:00 +0000'),
    ]);
    expect(trace.hops[0]).toMatchObject({
      from: 'mail.corp.com',
      by: 'mx.example.com',
      with: 'ESMTPS',
    });
  });

  it('computes the delay between consecutive hops', () => {
    const trace = parseReceived([
      hop('by c.example; Mon, 10 Aug 2026 09:00:20 +0000'),
      hop('by b.example; Mon, 10 Aug 2026 09:00:05 +0000'),
    ]);
    expect(trace.hops[0].delaySeconds).toBeNull();
    expect(trace.hops[1].delaySeconds).toBe(15);
    expect(trace.totalSeconds).toBe(15);
  });

  it('identifies the slowest hop', () => {
    const trace = parseReceived([
      hop('by d.example; Mon, 10 Aug 2026 09:01:30 +0000'),
      hop('by c.example; Mon, 10 Aug 2026 09:00:20 +0000'),
      hop('by b.example; Mon, 10 Aug 2026 09:00:00 +0000'),
    ]);
    expect(trace.slowest.by).toBe('d.example');
    expect(trace.slowest.delaySeconds).toBe(70);
  });

  it('ignores a hop with an unparseable date', () => {
    const trace = parseReceived([hop('from a by b; not a real date')]);
    expect(trace.hops[0].date).toBe('');
    expect(trace.hops[0].delaySeconds).toBeNull();
  });

  it('strips a trailing comment from the timestamp', () => {
    const trace = parseReceived([hop('by b.example; Mon, 10 Aug 2026 09:00:00 +0000 (UTC)')]);
    expect(trace.hops[0].date).not.toBe('');
  });

  it('ignores clock skew that would produce a negative delay', () => {
    const trace = parseReceived([
      hop('by c.example; Mon, 10 Aug 2026 08:59:00 +0000'),
      hop('by b.example; Mon, 10 Aug 2026 09:00:00 +0000'),
    ]);
    expect(trace.hops[1].delaySeconds).toBeNull();
  });
});
