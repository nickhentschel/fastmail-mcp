import { describe, it, expect, vi, afterEach } from 'vitest';
import { ContactsCalendarClient } from '../contacts-calendar.js';
import { FastmailAuth } from '../auth.js';

describe('ContactsCalendarClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Calendar methods removed', () => {
    it('does not have getCalendars method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect((client as any).getCalendars).toBeUndefined();
    });

    it('does not have getCalendarEvents method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect((client as any).getCalendarEvents).toBeUndefined();
    });

    it('does not have getCalendarEventById method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect((client as any).getCalendarEventById).toBeUndefined();
    });

    it('does not have createCalendarEvent method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect((client as any).createCalendarEvent).toBeUndefined();
    });

    it('does not have checkCalendarsPermission method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect((client as any).checkCalendarsPermission).toBeUndefined();
    });
  });

  describe('Contacts methods present', () => {
    it('has getContacts method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect(typeof client.getContacts).toBe('function');
    });

    it('has getContactById method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect(typeof client.getContactById).toBe('function');
    });

    it('has searchContacts method', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const client = new ContactsCalendarClient(auth);
      expect(typeof client.searchContacts).toBe('function');
    });
  });

  describe('getContacts', () => {
    it('throws when contacts capability is absent', async () => {
      const auth = new FastmailAuth({ apiToken: 'test-token' });
      const client = new ContactsCalendarClient(auth);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            apiUrl: 'https://api.fastmail.com/jmap/api/',
            accounts: { acc1: {} },
            capabilities: {},
          }),
      }));

      await expect(client.getContacts()).rejects.toThrow('Contacts access not available');
    });

    it('fetches contacts when capability is present', async () => {
      const auth = new FastmailAuth({ apiToken: 'test-token' });
      const client = new ContactsCalendarClient(auth);

      const mockContacts = [{ id: 'c1', name: [{ full: 'Alice' }], emails: [] }];

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              apiUrl: 'https://api.fastmail.com/jmap/api/',
              accounts: { acc1: {} },
              capabilities: { 'urn:ietf:params:jmap:contacts': {} },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              methodResponses: [
                ['Contact/query', { ids: ['c1'] }, 'query'],
                ['Contact/get', { list: mockContacts }, 'contacts'],
              ],
            }),
        })
      );

      const contacts = await client.getContacts(10);
      expect(contacts).toEqual(mockContacts);
    });
  });
});
