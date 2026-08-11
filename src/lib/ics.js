// Enough iCalendar to show a human what an invite says. Not a full RFC 5545
// implementation: no recurrence expansion, no timezone database.

function unfold(text) {
  // Long values are folded onto continuation lines starting with a space or tab.
  return text.replace(/\r?\n[ \t]/g, '');
}

function unescape(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseLine(line) {
  const at = line.indexOf(':');
  if (at === -1) return null;
  const rawName = line.slice(0, at);
  const value = line.slice(at + 1);
  const [name, ...paramChunks] = rawName.split(';');

  const params = {};
  for (const chunk of paramChunks) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    params[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1).replace(/^"(.*)"$/, '$1');
  }
  return { name: name.toUpperCase(), params, value };
}

// 20260605T155000Z or 20260605
export function parseIcsDate(value, params = {}) {
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  }
  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s).toISOString();
  }
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return new Date(Date.UTC(+y, +mo - 1, +d)).toISOString();
  }
  return params.VALUE === 'DATE' ? '' : '';
}

function personFrom(line) {
  const address = line.value.replace(/^mailto:/i, '');
  return {
    name: line.params.CN ?? '',
    address,
    status: line.params.PARTSTAT ?? '',
    role: line.params.ROLE ?? '',
  };
}

export function parseIcs(source) {
  if (!source || !source.includes('BEGIN:VEVENT')) return null;

  const lines = unfold(source).split(/\r?\n/);
  const event = {
    summary: '',
    description: '',
    location: '',
    start: '',
    end: '',
    allDay: false,
    organizer: null,
    attendees: [],
    method: '',
    status: '',
  };

  let inEvent = false;
  for (const raw of lines) {
    const line = parseLine(raw);
    if (!line) continue;

    if (line.name === 'METHOD') event.method = line.value.toUpperCase();
    if (line.name === 'BEGIN' && line.value === 'VEVENT') { inEvent = true; continue; }
    if (line.name === 'END' && line.value === 'VEVENT') break;
    if (!inEvent) continue;

    switch (line.name) {
      case 'SUMMARY': event.summary = unescape(line.value); break;
      case 'DESCRIPTION': event.description = unescape(line.value); break;
      case 'LOCATION': event.location = unescape(line.value); break;
      case 'STATUS': event.status = line.value; break;
      case 'DTSTART':
        event.start = parseIcsDate(line.value, line.params);
        event.allDay = line.params.VALUE === 'DATE' || /^\d{8}$/.test(line.value);
        break;
      case 'DTEND': event.end = parseIcsDate(line.value, line.params); break;
      case 'ORGANIZER': event.organizer = personFrom(line); break;
      case 'ATTENDEE': event.attendees.push(personFrom(line)); break;
      default: break;
    }
  }

  return event.summary || event.start ? event : null;
}

export function isCalendarPart(attachment) {
  const type = (attachment?.mimeType ?? '').toLowerCase();
  return type === 'text/calendar' || /\.ics$/i.test(attachment?.filename ?? '');
}
