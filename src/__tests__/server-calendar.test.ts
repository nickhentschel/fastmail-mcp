import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Use a hoisted regular-function constructor so `new CalDAVClient()` works
const mockCalDAV = vi.hoisted(() => ({
  getCalendars: vi.fn(),
  getCalendarEvents: vi.fn(),
  getCalendarEventByUrl: vi.fn(),
  createCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}));

vi.mock('../caldav-client.js', () => ({
  // Must be a regular function (not arrow) so it can be called with `new`
  CalDAVClient: vi.fn(function () {
    return mockCalDAV;
  }),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';

async function createTestPair() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return { client, server };
}

describe('Calendar tool handlers', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.FASTMAIL_API_TOKEN = process.env.FASTMAIL_API_TOKEN;
    savedEnv.FASTMAIL_USERNAME = process.env.FASTMAIL_USERNAME;
    savedEnv.FASTMAIL_CALDAV_PASSWORD = process.env.FASTMAIL_CALDAV_PASSWORD;

    // Calendar tools must work without a JMAP token
    delete process.env.FASTMAIL_API_TOKEN;
    process.env.FASTMAIL_USERNAME = 'user@fastmail.com';
    process.env.FASTMAIL_CALDAV_PASSWORD = 'app-password';

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.FASTMAIL_API_TOKEN = savedEnv.FASTMAIL_API_TOKEN;
    process.env.FASTMAIL_USERNAME = savedEnv.FASTMAIL_USERNAME;
    process.env.FASTMAIL_CALDAV_PASSWORD = savedEnv.FASTMAIL_CALDAV_PASSWORD;
  });

  describe('list_calendars', () => {
    it('calls getCalendars and returns JSON', async () => {
      const mockCalendars = [
        { url: 'https://caldav.fastmail.com/calendars/1/', displayName: 'Personal' },
      ];
      mockCalDAV.getCalendars.mockResolvedValue(mockCalendars);

      const { client } = await createTestPair();
      const result = await client.callTool({ name: 'list_calendars', arguments: {} });

      expect(mockCalDAV.getCalendars).toHaveBeenCalledOnce();
      const parsed = JSON.parse((result.content as any)[0].text);
      expect(parsed).toEqual(mockCalendars);
    });

    it('throws McpError when FASTMAIL_USERNAME is missing', async () => {
      delete process.env.FASTMAIL_USERNAME;

      const { client } = await createTestPair();
      await expect(
        client.callTool({ name: 'list_calendars', arguments: {} })
      ).rejects.toThrow('FASTMAIL_USERNAME');
    });

    it('throws McpError when FASTMAIL_CALDAV_PASSWORD is missing', async () => {
      delete process.env.FASTMAIL_CALDAV_PASSWORD;

      const { client } = await createTestPair();
      await expect(
        client.callTool({ name: 'list_calendars', arguments: {} })
      ).rejects.toThrow('FASTMAIL_CALDAV_PASSWORD');
    });
  });

  describe('list_calendar_events', () => {
    it('calls getCalendarEvents with calendarUrl', async () => {
      mockCalDAV.getCalendarEvents.mockResolvedValue([]);

      const { client } = await createTestPair();
      await client.callTool({
        name: 'list_calendar_events',
        arguments: { calendarUrl: 'https://caldav.fastmail.com/calendars/1/' },
      });

      expect(mockCalDAV.getCalendarEvents).toHaveBeenCalledWith(
        'https://caldav.fastmail.com/calendars/1/',
        undefined
      );
    });

    it('passes time range when timeRangeStart and timeRangeEnd are provided', async () => {
      mockCalDAV.getCalendarEvents.mockResolvedValue([]);

      const { client } = await createTestPair();
      await client.callTool({
        name: 'list_calendar_events',
        arguments: {
          calendarUrl: 'https://caldav.fastmail.com/calendars/1/',
          timeRangeStart: '2024-01-01T00:00:00Z',
          timeRangeEnd: '2024-01-31T23:59:59Z',
        },
      });

      const call = mockCalDAV.getCalendarEvents.mock.calls[0];
      expect(call[0]).toBe('https://caldav.fastmail.com/calendars/1/');
      expect(call[1]).toMatchObject({
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T23:59:59Z'),
      });
    });

    it('throws McpError when calendarUrl is missing', async () => {
      const { client } = await createTestPair();
      await expect(
        client.callTool({ name: 'list_calendar_events', arguments: {} })
      ).rejects.toThrow('calendarUrl is required');
    });
  });

  describe('get_calendar_event', () => {
    it('calls getCalendarEventByUrl and returns parsed event', async () => {
      const mockEvent = {
        url: 'https://caldav.fastmail.com/calendars/1/event.ics',
        etag: '"abc"',
        uid: 'test-uid',
        title: 'Test',
        start: '20240101T100000Z',
        end: '20240101T110000Z',
      };
      mockCalDAV.getCalendarEventByUrl.mockResolvedValue(mockEvent);

      const { client } = await createTestPair();
      const result = await client.callTool({
        name: 'get_calendar_event',
        arguments: { eventId: 'https://caldav.fastmail.com/calendars/1/event.ics' },
      });

      expect(mockCalDAV.getCalendarEventByUrl).toHaveBeenCalledWith(
        'https://caldav.fastmail.com/calendars/1/event.ics'
      );
      const parsed = JSON.parse((result.content as any)[0].text);
      expect(parsed).toEqual(mockEvent);
    });

    it('throws McpError when event URL returns null', async () => {
      mockCalDAV.getCalendarEventByUrl.mockResolvedValue(null);

      const { client } = await createTestPair();
      await expect(
        client.callTool({
          name: 'get_calendar_event',
          arguments: { eventId: 'https://caldav.fastmail.com/calendars/1/missing.ics' },
        })
      ).rejects.toThrow('Event not found');
    });
  });

  describe('create_calendar_event', () => {
    it('calls createCalendarEvent with parsed Date objects and returns event URL', async () => {
      const expectedUrl = 'https://caldav.fastmail.com/calendars/1/new-uid.ics';
      mockCalDAV.createCalendarEvent.mockResolvedValue(expectedUrl);

      const { client } = await createTestPair();
      const result = await client.callTool({
        name: 'create_calendar_event',
        arguments: {
          calendarUrl: 'https://caldav.fastmail.com/calendars/1/',
          title: 'New Event',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T11:00:00Z',
        },
      });

      expect(mockCalDAV.createCalendarEvent).toHaveBeenCalledOnce();
      const call = mockCalDAV.createCalendarEvent.mock.calls[0];
      expect(call[0]).toBe('https://caldav.fastmail.com/calendars/1/');
      expect(call[1]).toMatchObject({
        title: 'New Event',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      });
      const text = (result.content as any)[0].text;
      expect(text).toContain(expectedUrl);
    });

    it('throws McpError when required fields are missing', async () => {
      const { client } = await createTestPair();
      await expect(
        client.callTool({
          name: 'create_calendar_event',
          arguments: { calendarUrl: 'https://caldav.fastmail.com/calendars/1/' },
        })
      ).rejects.toThrow('calendarUrl, title, start, and end are required');
    });
  });
});
