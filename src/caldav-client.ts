import { createDAVClient } from 'tsdav';
import { randomUUID } from 'node:crypto';

export interface Calendar {
  calendarUrl: string;
  name: string;
  description?: string;
  color?: string;
}

export interface CalendarEvent {
  url: string;
  etag: string;
  uid: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
}

export interface NewEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  participants?: Array<{ email: string; name?: string }>;
}

function extractIcsField(ics: string, field: string): string | undefined {
  const regex = new RegExp(`^${field}(?:;[^:\\r\\n]*)?:([^\\r\\n]*)`, 'm');
  const match = ics.match(regex);
  return match ? match[1].trim() : undefined;
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildIcs(uid: string, event: NewEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//fastmail-mcp//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(event.end)}`,
    `SUMMARY:${event.title}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${event.description}`);
  if (event.location) lines.push(`LOCATION:${event.location}`);

  for (const p of event.participants ?? []) {
    const cn = p.name ? `;CN=${p.name}` : '';
    lines.push(`ATTENDEE${cn}:mailto:${p.email}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export class CalDAVClient {
  private username: string;
  private password: string;
  private serverUrl = 'https://caldav.fastmail.com';

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  private async createClient() {
    return createDAVClient({
      serverUrl: this.serverUrl,
      credentials: {
        username: this.username,
        password: this.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
  }

  async getCalendars(): Promise<Calendar[]> {
    const client = await this.createClient();
    const calendars = await client.fetchCalendars();
    return calendars.map(cal => {
      const rawColor = (cal as any).calendarColor;
      const color: string | undefined =
        typeof rawColor === 'string' ? rawColor : rawColor?._cdata ?? undefined;
      return {
        calendarUrl: cal.url,
        name: typeof cal.displayName === 'string' ? cal.displayName : 'Unnamed Calendar',
        description: cal.description,
        color,
      };
    });
  }

  async getCalendarEvents(
    calendarUrl: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    const client = await this.createClient();
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      timeRange: timeRange
        ? { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() }
        : undefined,
    });
    return objects.map(obj => {
      const ics = obj.data ?? '';
      return {
        url: obj.url,
        etag: obj.etag ?? '',
        uid: extractIcsField(ics, 'UID') ?? obj.url,
        title: extractIcsField(ics, 'SUMMARY') ?? 'Untitled',
        description: extractIcsField(ics, 'DESCRIPTION'),
        start: extractIcsField(ics, 'DTSTART') ?? '',
        end: extractIcsField(ics, 'DTEND') ?? '',
        location: extractIcsField(ics, 'LOCATION'),
      };
    });
  }

  async getCalendarEventByUrl(eventUrl: string): Promise<CalendarEvent | null> {
    const client = await this.createClient();
    // Derive calendar URL by removing the event filename from the path
    const calendarUrl = eventUrl.replace(/\/[^/]+$/, '/');
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      objectUrls: [eventUrl],
    });
    if (objects.length === 0) return null;
    const obj = objects[0];
    const ics = obj.data ?? '';
    return {
      url: obj.url,
      etag: obj.etag ?? '',
      uid: extractIcsField(ics, 'UID') ?? obj.url,
      title: extractIcsField(ics, 'SUMMARY') ?? 'Untitled',
      description: extractIcsField(ics, 'DESCRIPTION'),
      start: extractIcsField(ics, 'DTSTART') ?? '',
      end: extractIcsField(ics, 'DTEND') ?? '',
      location: extractIcsField(ics, 'LOCATION'),
    };
  }

  async createCalendarEvent(calendarUrl: string, event: NewEvent): Promise<string> {
    const client = await this.createClient();
    const uid = randomUUID();
    const filename = `${uid}.ics`;
    await client.createCalendarObject({
      calendar: { url: calendarUrl },
      filename,
      iCalString: buildIcs(uid, event),
    });
    return `${calendarUrl.replace(/\/$/, '')}/${filename}`;
  }

  async deleteCalendarEvent(eventUrl: string): Promise<void> {
    const client = await this.createClient();
    await client.deleteCalendarObject({
      calendarObject: { url: eventUrl, etag: '' },
    });
  }
}
