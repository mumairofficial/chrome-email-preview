import { summarizeLinks } from '../../lib/links.js';

const RESULT_TONE = {
  pass: 'ok',
  fail: 'bad',
  softfail: 'bad',
  neutral: 'muted',
  none: 'muted',
  unknown: 'muted',
};

function section(title) {
  const el = document.createElement('section');
  el.className = 'sec';
  const h = document.createElement('h2');
  h.className = 'sec__title';
  h.textContent = title;
  el.append(h);
  return el;
}

function note(text) {
  const p = document.createElement('p');
  p.className = 'sec__note';
  p.textContent = text;
  return p;
}

export function renderChip(text, tone) {
  const chip = document.createElement('span');
  chip.className = `chip chip--${tone}`;
  chip.textContent = text;
  return chip;
}

function authSection(auth) {
  const el = section('Authentication');

  if (!auth.checked) {
    el.append(note(
      auth.signedByDkim
        ? 'This message carries a DKIM signature, but no server recorded a result for it.'
        : 'No receiving server recorded SPF, DKIM or DMARC results for this message.'
    ));
    return el;
  }

  const row = document.createElement('div');
  row.className = 'chips';
  for (const { method, result, detail } of auth.results) {
    const chip = renderChip(`${method.toUpperCase()} ${result}`, RESULT_TONE[result] ?? 'muted');
    if (detail) chip.title = detail;
    row.append(chip);
  }
  el.append(row);
  el.append(note('Reported by the receiving mail server. Displayed, not verified here.'));
  return el;
}

function formatDelay(seconds) {
  if (seconds === null) return '';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function deliverySection(trace) {
  const el = section('Delivery path');

  if (trace.hops.length === 0) {
    el.append(note('This message carries no Received headers.'));
    return el;
  }

  const list = document.createElement('ol');
  list.className = 'hops';
  for (const hop of trace.hops) {
    const item = document.createElement('li');
    item.className = 'hop';
    if (trace.slowest && hop === trace.slowest && hop.delaySeconds > 0) {
      item.classList.add('hop--slow');
    }

    const where = document.createElement('span');
    where.className = 'hop__where';
    where.textContent = hop.by || hop.from || '(unknown host)';
    item.append(where);

    if (hop.with) {
      const proto = document.createElement('span');
      proto.className = 'hop__proto';
      proto.textContent = hop.with;
      item.append(proto);
    }

    const delay = formatDelay(hop.delaySeconds);
    if (delay) {
      const gap = document.createElement('span');
      gap.className = 'hop__delay';
      gap.textContent = `+${delay}`;
      item.append(gap);
    }

    item.title = hop.raw;
    list.append(item);
  }

  el.append(list);
  if (trace.totalSeconds > 0) {
    el.append(note(`${trace.hops.length} hops, ${formatDelay(trace.totalSeconds)} in transit.`));
  }
  return el;
}

function linkRow(link) {
  const row = document.createElement('tr');
  if (link.mismatch || link.punycode) row.className = 'link--suspect';

  const text = document.createElement('td');
  text.textContent = link.text || '(no text)';
  const host = document.createElement('td');
  host.textContent = link.host || link.href;
  const flags = document.createElement('td');

  if (link.mismatch) flags.append(renderChip('text mismatch', 'bad'));
  if (link.punycode) flags.append(renderChip('punycode', 'bad'));
  if (link.insecure) flags.append(renderChip('http', 'warn'));

  row.append(text, host, flags);
  row.title = link.href;
  return row;
}

function linksSection(links) {
  const el = section('Links');

  if (links.length === 0) {
    el.append(note('This message contains no outbound links.'));
    return el;
  }

  const summary = summarizeLinks(links);
  const table = document.createElement('table');
  table.className = 'links';
  const head = document.createElement('tr');
  for (const label of ['Text', 'Goes to', '']) {
    const th = document.createElement('th');
    th.textContent = label;
    head.append(th);
  }
  table.append(head);
  for (const link of links) table.append(linkRow(link));

  el.append(table);
  el.append(note(
    summary.suspicious > 0
      ? `${summary.suspicious} of ${summary.total} links ${summary.suspicious === 1 ? 'does' : 'do'} not go where the text claims.`
      : `${summary.total} links across ${summary.hosts.length} hosts.`
  ));
  return el;
}

function trackersSection(blocked) {
  const el = section('Remote content');

  if (blocked.length === 0) {
    el.append(note('This message requested no remote content.'));
    return el;
  }

  const trackers = blocked.filter((b) => b.tracker);
  const list = document.createElement('ul');
  list.className = 'remote';
  for (const item of blocked) {
    const li = document.createElement('li');
    if (item.tracker) li.append(renderChip('tracking pixel', 'bad'));
    const url = document.createElement('span');
    url.className = 'remote__url';
    url.textContent = item.url;
    li.append(url);
    list.append(li);
  }

  el.append(list);
  el.append(note(
    trackers.length > 0
      ? `${trackers.length} of ${blocked.length} blocked resources are invisible pixels that would report when you opened this message.`
      : `${blocked.length} remote resources, blocked until you load them.`
  ));
  return el;
}

export function renderSecurity({ auth, trace, links, blocked }) {
  const wrap = document.createElement('div');
  wrap.className = 'security';
  wrap.append(
    authSection(auth),
    deliverySection(trace),
    linksSection(links),
    trackersSection(blocked)
  );
  return wrap;
}
