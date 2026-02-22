import { describe, it, expect } from 'vitest';
import { FastmailAuth } from '../auth.js';

describe('FastmailAuth', () => {
  describe('URL normalization (via getSessionUrl)', () => {
    it('uses default URL when no baseUrl provided', () => {
      const auth = new FastmailAuth({ apiToken: 'test-token' });
      expect(auth.getSessionUrl()).toBe('https://api.fastmail.com/jmap/session');
    });

    it('uses default URL when baseUrl is undefined', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: undefined });
      expect(auth.getSessionUrl()).toBe('https://api.fastmail.com/jmap/session');
    });

    it('strips trailing slashes', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'https://api.fastmail.com///' });
      expect(auth.getSessionUrl()).toBe('https://api.fastmail.com/jmap/session');
    });

    it('adds https:// when no scheme is present', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'api.fastmail.com' });
      expect(auth.getSessionUrl()).toBe('https://api.fastmail.com/jmap/session');
    });

    it('preserves http:// scheme', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'http://localhost:8080' });
      expect(auth.getSessionUrl()).toBe('http://localhost:8080/jmap/session');
    });

    it('preserves https:// on a custom host', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'https://custom.example.com' });
      expect(auth.getSessionUrl()).toBe('https://custom.example.com/jmap/session');
    });

    it('strips single trailing slash', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'https://api.fastmail.com/' });
      expect(auth.getSessionUrl()).toBe('https://api.fastmail.com/jmap/session');
    });
  });

  describe('getAuthHeaders', () => {
    it('returns Bearer token authorization header', () => {
      const auth = new FastmailAuth({ apiToken: 'my-secret-token' });
      const headers = auth.getAuthHeaders();
      expect(headers['Authorization']).toBe('Bearer my-secret-token');
    });

    it('returns application/json content type', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      const headers = auth.getAuthHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('getApiUrl', () => {
    it('returns JMAP API URL', () => {
      const auth = new FastmailAuth({ apiToken: 'test' });
      expect(auth.getApiUrl()).toBe('https://api.fastmail.com/jmap/api/');
    });

    it('uses custom base URL for API endpoint', () => {
      const auth = new FastmailAuth({ apiToken: 'test', baseUrl: 'https://custom.example.com' });
      expect(auth.getApiUrl()).toBe('https://custom.example.com/jmap/api/');
    });
  });
});
