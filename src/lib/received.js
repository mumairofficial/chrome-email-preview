// Received headers are prepended by each hop, so the list reads newest first.
// Reversing it gives the message's actual journey, and the gap between
// consecutive timestamps is where delivery time was spent.

function parseHop(value) {
  const at = value.lastIndexOf(';');
  const trace = at === -1 ? value : value.slice(0, at);
  const stamp = at === -1 ? '' : value.slice(at + 1).trim();

  const date = stamp ? new Date(stamp.replace(/\s*\(.*\)\s*$/, '')) : null;
  return {
    from: match(trace, /\bfrom\s+([^\s;]+)/i),
    by: match(trace, /\bby\s+([^\s;]+)/i),
    with: match(trace, /\bwith\s+([A-Za-z0-9/.-]+)/i),
    date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
    raw: value,
  };
}

function match(text, pattern) {
  const found = pattern.exec(text);
  return found ? found[1] : '';
}

export function parseReceived(headers) {
  const values = (headers ?? [])
    .filter((h) => h.key?.toLowerCase() === 'received')
    .map((h) => h.value ?? '');

  // Oldest first: the order the message actually travelled.
  const hops = values.reverse().map(parseHop);

  let previous = null;
  for (const hop of hops) {
    hop.delaySeconds = null;
    if (hop.date && previous) {
      const gap = (new Date(hop.date) - new Date(previous)) / 1000;
      if (gap >= 0) hop.delaySeconds = Math.round(gap);
    }
    if (hop.date) previous = hop.date;
  }

  const timed = hops.filter((h) => h.delaySeconds !== null);
  return {
    hops,
    totalSeconds: timed.reduce((sum, h) => sum + h.delaySeconds, 0),
    slowest: timed.reduce((worst, h) => (!worst || h.delaySeconds > worst.delaySeconds ? h : worst), null),
  };
}
