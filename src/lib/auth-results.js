// These headers are written by the *receiving* server. Nothing here is
// verified locally — no DNS lookup, no signature check. It reports what the
// mail system said, which is the honest thing a local viewer can do.

const METHODS = ['spf', 'dkim', 'dmarc'];
const KNOWN_RESULTS = ['pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror', 'policy'];

function headerValues(headers, name) {
  return (headers ?? [])
    .filter((h) => h.key?.toLowerCase() === name)
    .map((h) => h.value ?? '');
}

// "spf=pass smtp.mailfrom=example.com" -> { method: 'spf', result: 'pass', detail: '...' }
function parseOne(value) {
  const found = [];
  for (const method of METHODS) {
    const match = new RegExp(`\\b${method}\\s*=\\s*([a-z]+)`, 'i').exec(value);
    if (!match) continue;
    const result = match[1].toLowerCase();
    found.push({
      method,
      result: KNOWN_RESULTS.includes(result) ? result : 'unknown',
      detail: detailFor(value, method),
    });
  }
  return found;
}

function detailFor(value, method) {
  const patterns = {
    spf: /smtp\.mailfrom\s*=\s*([^\s;]+)/i,
    dkim: /header\.(?:d|i)\s*=\s*([^\s;]+)/i,
    dmarc: /header\.from\s*=\s*([^\s;]+)/i,
  };
  const match = patterns[method]?.exec(value);
  return match ? match[1] : '';
}

export function parseAuthResults(headers) {
  const raw = [
    ...headerValues(headers, 'authentication-results'),
    ...headerValues(headers, 'arc-authentication-results'),
  ];

  const byMethod = new Map();
  for (const value of raw) {
    for (const entry of parseOne(value)) {
      // First mention wins: the topmost header is the closest hop to the reader.
      if (!byMethod.has(entry.method)) byMethod.set(entry.method, entry);
    }
  }

  const results = METHODS.filter((m) => byMethod.has(m)).map((m) => byMethod.get(m));
  return {
    results,
    // Only a real failure is worth alarming about; absent checks are not failures.
    hasFailure: results.some((r) => r.result === 'fail' || r.result === 'softfail'),
    checked: results.length > 0,
    signedByDkim: headerValues(headers, 'dkim-signature').length > 0,
  };
}
