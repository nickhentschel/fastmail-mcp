import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDavClient = vi.hoisted(() => ({
  fetchCalendars: vi.fn(),
  fetchCalendarObjects: vi.fn(),
  createCalendarObject: vi.fn(),
  deleteCalendarObject: vi.fn(),
}));

const mockCreateDAVClient = vi.hoisted(() => vi.fn());

vi.mock('tsdav', () => ({
  createDAVClient: mockCreateDAVClient,
}));

import { createDAVClient } from 'tsdav';
import { CalDAVClient } from '../caldav-client.js';

describe('CalDAVClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDAVClient.mockResolvedValue(mockDavClient);
  });

  describe('getCalendars', () => {
    it('returns mapped calendar list', async () => {
      mockDavClient.fetchCalendars.mockResolvedValue([
        {
          url: 'https://caldav.fastmail.com/calendars/1/',
          displayName: 'Personal',
          description: 'My calendar',
          calendarColor: '#ff0000',
        },
        { url: 'https://caldav.fastmail.com/calendars/2/', displayName: 'Work' },
      ]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const calendars = await client.getCalendars();

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        url: 'https://caldav.fastmail.com/calendars/1/',
        displayName: 'Personal',
        description: 'My calendar',
        color: '#ff0000',
      });
      expect(calendars[1].displayName).toBe('Work');
    });

    it('uses "Unnamed Calendar" when displayName is absent', async () => {
      mockDavClient.fetchCalendars.mockResolvedValue([
        { url: 'https://caldav.fastmail.com/calendars/1/' },
      ]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const calendars = await client.getCalendars();

      expect(calendars[0].displayName).toBe('Unnamed Calendar');
    });

    it('creates DAV client with Basic auth and caldav account type', async () => {
      mockDavClient.fetchCalendars.mockResolvedValue([]);

      const client = new CalDAVClient('user@example.com', 'secret-pass');
      await client.getCalendars();

      expect(createDAVClient).toHaveBeenCalledWith({
        serverUrl: 'https://caldav.fastmail.com',
        credentials: { username: 'user@example.com', password: 'secret-pass' },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
    });

    it('propagates errors from fetchCalendars', async () => {
      mockDavClient.fetchCalendars.mockRejectedValue(new Error('Auth failed'));

      const client = new CalDAVClient('user@fastmail.com', 'wrong');
      await expect(client.getCalendars()).rejects.toThrow('Auth failed');
    });
  });

  describe('getCalendarEvents', () => {
    const sampleIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:test-uid-123',
      'SUMMARY:Team Meeting',
      'DESCRIPTION:Weekly sync',
      'DTSTART:20240101T100000Z',
      'DTEND:20240101T110000Z',
      'LOCATION:Conference Room',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    it('returns parsed events from iCal data', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([
        {
          url: 'https://caldav.fastmail.com/calendars/1/event.ics',
          etag: '"abc123"',
          data: sampleIcs,
        },
      ]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const events = await client.getCalendarEvents('https://caldav.fastmail.com/calendars/1/');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        url: 'https://caldav.fastmail.com/calendars/1/event.ics',
        etag: '"abc123"',
        uid: 'test-uid-123',
        title: 'Team Meeting',
        description: 'Weekly sync',
        start: '20240101T100000Z',
        end: '20240101T110000Z',
        location: 'Conference Room',
      });
    });

    it('passes time range to fetchCalendarObjects', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      await client.getCalendarEvents('https://caldav.fastmail.com/calendars/1/', { start, end });

      expect(mockDavClient.fetchCalendarObjects).toHaveBeenCalledWith({
        calendar: { url: 'https://caldav.fastmail.com/calendars/1/' },
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
    });

    it('passes undefined timeRange when not provided', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await client.getCalendarEvents('https://caldav.fastmail.com/calendars/1/');

      expect(mockDavClient.fetchCalendarObjects).toHaveBeenCalledWith({
        calendar: { url: 'https://caldav.fastmail.com/calendars/1/' },
        timeRange: undefined,
      });
    });

    it('uses event URL as uid fallback when UID field is absent', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([
        { url: 'https://caldav.fastmail.com/calendars/1/event.ics', etag: '', data: '' },
      ]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const events = await client.getCalendarEvents('https://caldav.fastmail.com/calendars/1/');

      expect(events[0].uid).toBe('https://caldav.fastmail.com/calendars/1/event.ics');
    });
  });

  describe('getCalendarEventByUrl', () => {
    it('returns parsed event when found', async () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:specific-uid',
        'SUMMARY:Specific Event',
        'DTSTART:20240115T100000Z',
        'DTEND:20240115T110000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      mockDavClient.fetchCalendarObjects.mockResolvedValue([
        { url: 'https://caldav.fastmail.com/calendars/1/specific.ics', etag: '"xyz"', data: ics },
      ]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const event = await client.getCalendarEventByUrl(
        'https://caldav.fastmail.com/calendars/1/specific.ics'
      );

      expect(event).not.toBeNull();
      expect(event!.uid).toBe('specific-uid');
      expect(event!.title).toBe('Specific Event');
    });

    it('derives calendar URL by stripping the filename', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await client.getCalendarEventByUrl('https://caldav.fastmail.com/calendars/1/event.ics');

      expect(mockDavClient.fetchCalendarObjects).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar: { url: 'https://caldav.fastmail.com/calendars/1/' },
          objectUrls: ['https://caldav.fastmail.com/calendars/1/event.ics'],
        })
      );
    });

    it('returns null when no object found', async () => {
      mockDavClient.fetchCalendarObjects.mockResolvedValue([]);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const event = await client.getCalendarEventByUrl(
        'https://caldav.fastmail.com/calendars/1/missing.ics'
      );

      expect(event).toBeNull();
    });
  });

  describe('createCalendarEvent', () => {
    it('creates event and returns its URL', async () => {
      mockDavClient.createCalendarObject.mockResolvedValue(undefined);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const url = await client.createCalendarEvent('https://caldav.fastmail.com/calendars/1/', {
        title: 'New Meeting',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      });

      expect(url).toMatch(/^https:\/\/caldav\.fastmail\.com\/calendars\/1\/[0-9a-f-]+\.ics$/);
      expect(mockDavClient.createCalendarObject).toHaveBeenCalledOnce();

      const callArg = mockDavClient.createCalendarObject.mock.calls[0][0];
      expect(callArg.calendar.url).toBe('https://caldav.fastmail.com/calendars/1/');
      expect(callArg.filename).toMatch(/^[0-9a-f-]+\.ics$/);
      expect(callArg.iCalString).toContain('SUMMARY:New Meeting');
      expect(callArg.iCalString).toContain('BEGIN:VCALENDAR');
      expect(callArg.iCalString).toContain('END:VEVENT');
    });

    it('includes optional description and location in iCal', async () => {
      mockDavClient.createCalendarObject.mockResolvedValue(undefined);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await client.createCalendarEvent('https://caldav.fastmail.com/calendars/1/', {
        title: 'Meeting',
        description: 'Detailed notes here',
        location: 'Room 101',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      });

      const ics: string = mockDavClient.createCalendarObject.mock.calls[0][0].iCalString;
      expect(ics).toContain('DESCRIPTION:Detailed notes here');
      expect(ics).toContain('LOCATION:Room 101');
    });

    it('includes participants as ATTENDEE lines in iCal', async () => {
      mockDavClient.createCalendarObject.mockResolvedValue(undefined);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await client.createCalendarEvent('https://caldav.fastmail.com/calendars/1/', {
        title: 'Meeting',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
        participants: [
          { email: 'alice@example.com', name: 'Alice' },
          { email: 'bob@example.com' },
        ],
      });

      const ics: string = mockDavClient.createCalendarObject.mock.calls[0][0].iCalString;
      expect(ics).toContain('ATTENDEE;CN=Alice:mailto:alice@example.com');
      expect(ics).toContain('ATTENDEE:mailto:bob@example.com');
    });

    it('strips trailing slash from calendarUrl before building event URL', async () => {
      mockDavClient.createCalendarObject.mockResolvedValue(undefined);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      const url = await client.createCalendarEvent(
        'https://caldav.fastmail.com/calendars/1/',
        { title: 'Test', start: new Date(), end: new Date() }
      );

      // Should not have double slash
      expect(url).not.toContain('//calendars');
      expect(url).toMatch(/\/calendars\/1\/[^/]+\.ics$/);
    });
  });

  describe('deleteCalendarEvent', () => {
    it('calls deleteCalendarObject with the event URL', async () => {
      mockDavClient.deleteCalendarObject.mockResolvedValue(undefined);

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await client.deleteCalendarEvent('https://caldav.fastmail.com/calendars/1/event.ics');

      expect(mockDavClient.deleteCalendarObject).toHaveBeenCalledWith({
        calendarObject: {
          url: 'https://caldav.fastmail.com/calendars/1/event.ics',
          etag: '',
        },
      });
    });

    it('propagates errors from deleteCalendarObject', async () => {
      mockDavClient.deleteCalendarObject.mockRejectedValue(new Error('Not found'));

      const client = new CalDAVClient('user@fastmail.com', 'apppassword');
      await expect(
        client.deleteCalendarEvent('https://caldav.fastmail.com/calendars/1/missing.ics')
      ).rejects.toThrow('Not found');
    });
  });
});
