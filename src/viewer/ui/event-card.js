import { formatDate } from '../format.js';

const METHOD_LABEL = {
  REQUEST: 'Invitation',
  CANCEL: 'Cancelled',
  REPLY: 'Reply',
  COUNTER: 'Counter-proposal',
};

const STATUS_LABEL = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  'NEEDS-ACTION': 'no reply',
};

function row(label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

function when(event) {
  if (!event.start) return '';
  if (event.allDay) return `${formatDate(event.start).split(',')[0]} (all day)`;
  const start = formatDate(event.start);
  if (!event.end) return start;
  // Same day: only the time is worth repeating.
  const sameDay = event.start.slice(0, 10) === event.end.slice(0, 10);
  const end = formatDate(event.end);
  return sameDay ? `${start} – ${end.split(', ').pop()}` : `${start} – ${end}`;
}

export function renderEventCard(event, { onDownload } = {}) {
  const card = document.createElement('section');
  card.className = 'event-card';
  if (event.method === 'CANCEL') card.classList.add('event-card--cancelled');

  const kind = document.createElement('p');
  kind.className = 'event-card__kind';
  kind.textContent = METHOD_LABEL[event.method] ?? 'Event';
  card.append(kind);

  const title = document.createElement('h2');
  title.className = 'event-card__title';
  title.textContent = event.summary || '(untitled event)';
  card.append(title);

  const fields = document.createElement('dl');
  fields.className = 'event-card__fields';

  const whenText = when(event);
  if (whenText) fields.append(...row('When', whenText));
  if (event.location) fields.append(...row('Where', event.location));
  if (event.organizer) {
    fields.append(...row('Organiser', event.organizer.name || event.organizer.address));
  }
  if (event.attendees.length) {
    const who = event.attendees
      .map((a) => {
        const name = a.name || a.address;
        const status = STATUS_LABEL[a.status];
        return status ? `${name} (${status})` : name;
      })
      .join(', ');
    fields.append(...row('Attendees', who));
  }
  card.append(fields);

  if (event.description) {
    const description = document.createElement('p');
    description.className = 'event-card__description';
    description.textContent = event.description;
    card.append(description);
  }

  if (onDownload) {
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save to calendar (.ics)';
    save.addEventListener('click', onDownload);
    card.append(save);
  }

  return card;
}
