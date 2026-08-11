import { describe, it, expect } from 'vitest';
import { parseIcs, parseIcsDate, isCalendarPart } from '../src/lib/ics.js';

const INVITE = [
  'BEGIN:VCALENDAR',
  'METHOD:REQUEST',
  'BEGIN:VEVENT',
  'SUMMARY:Quarterly review',
  'DTSTART:20260605T150000Z',
  'DTEND:20260605T160000Z',
  'LOCATION:Room 4\\, Level 2',
  'DESCRIPTION:Bring the deck\\nand the numbers',
  'ORGANIZER;CN=Ana Ruiz:mailto:ana@corp.com',
  'ATTENDEE;CN=Bob;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT:mailto:bob@corp.com',
  'ATTENDEE;CN=Carol;PARTSTAT=NEEDS-ACTION:mailto:carol@corp.com',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcsDate', () => {
  it('reads a UTC timestamp', () => {
    expect(parseIcsDate('20260605T150000Z')).toBe('2026-06-05T15:00:00.000Z');
  });

  it('reads a date-only value', () => {
    expect(parseIcsDate('20260605')).toBe('2026-06-05T00:00:00.000Z');
  });

  it('returns empty for nonsense', () => {
    expect(parseIcsDate('later')).toBe('');
  });
});

describe('parseIcs', () => {
  it('returns null when there is no event', () => {
    expect(parseIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBeNull();
    expect(parseIcs('')).toBeNull();
  });

  it('reads the core event fields', () => {
    const event = parseIcs(INVITE);
    expect(event.summary).toBe('Quarterly review');
    expect(event.start).toBe('2026-06-05T15:00:00.000Z');
    expect(event.end).toBe('2026-06-05T16:00:00.000Z');
    expect(event.method).toBe('REQUEST');
  });

  it('unescapes commas and newlines', () => {
    const event = parseIcs(INVITE);
    expect(event.location).toBe('Room 4, Level 2');
    expect(event.description).toBe('Bring the deck\nand the numbers');
  });

  it('reads the organizer and attendees with their status', () => {
    const event = parseIcs(INVITE);
    expect(event.organizer).toMatchObject({ name: 'Ana Ruiz', address: 'ana@corp.com' });
    expect(event.attendees).toHaveLength(2);
    expect(event.attendees[1]).toMatchObject({ name: 'Carol', status: 'NEEDS-ACTION' });
  });

  it('unfolds long values split across lines', () => {
    const folded = 'BEGIN:VEVENT\r\nSUMMARY:A very long title that got\r\n  folded across lines\r\nEND:VEVENT';
    expect(parseIcs(folded).summary).toBe('A very long title that got folded across lines');
  });

  it('marks an all-day event', () => {
    const allDay = 'BEGIN:VEVENT\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20260605\r\nEND:VEVENT';
    expect(parseIcs(allDay).allDay).toBe(true);
  });
});

describe('isCalendarPart', () => {
  it('matches by mime type or filename', () => {
    expect(isCalendarPart({ mimeType: 'text/calendar', filename: 'x' })).toBe(true);
    expect(isCalendarPart({ mimeType: 'application/octet-stream', filename: 'invite.ics' })).toBe(true);
    expect(isCalendarPart({ mimeType: 'text/plain', filename: 'notes.txt' })).toBe(false);
  });
});
