import { JmapClient, JmapRequest } from './jmap-client.js';

export class ContactsCalendarClient extends JmapClient {

  private async checkContactsPermission(): Promise<boolean> {
    const session = await this.getSession();
    return !!session.capabilities['urn:ietf:params:jmap:contacts'];
  }

  async getContacts(limit: number = 50): Promise<any[]> {
    // Check permissions first
    const hasPermission = await this.checkContactsPermission();
    if (!hasPermission) {
      throw new Error('Contacts access not available. This account may not have JMAP contacts permissions enabled. Please check your Fastmail account settings or contact support to enable contacts API access.');
    }

    const session = await this.getSession();
    
    // Try CardDAV namespace first, then Fastmail specific
    const request: JmapRequest = {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:contacts'],
      methodCalls: [
        ['Contact/query', {
          accountId: session.accountId,
          limit
        }, 'query'],
        ['Contact/get', {
          accountId: session.accountId,
          '#ids': { resultOf: 'query', name: 'Contact/query', path: '/ids' },
          properties: ['id', 'name', 'emails', 'phones', 'addresses', 'notes']
        }, 'contacts']
      ]
    };

    try {
      const response = await this.makeRequest(request);
      return response.methodResponses[1][1].list;
    } catch (error) {
      // Fallback: try to get contacts using AddressBook methods
      const fallbackRequest: JmapRequest = {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:contacts'],
        methodCalls: [
          ['AddressBook/get', {
            accountId: session.accountId
          }, 'addressbooks']
        ]
      };
      
      try {
        const fallbackResponse = await this.makeRequest(fallbackRequest);
        return fallbackResponse.methodResponses[0][1].list || [];
      } catch (fallbackError) {
        throw new Error(`Contacts not supported or accessible: ${error instanceof Error ? error.message : String(error)}. Try checking account permissions or enabling contacts API access in Fastmail settings.`);
      }
    }
  }

  async getContactById(id: string): Promise<any> {
    // Check permissions first
    const hasPermission = await this.checkContactsPermission();
    if (!hasPermission) {
      throw new Error('Contacts access not available. This account may not have JMAP contacts permissions enabled. Please check your Fastmail account settings or contact support to enable contacts API access.');
    }

    const session = await this.getSession();
    
    const request: JmapRequest = {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:contacts'],
      methodCalls: [
        ['Contact/get', {
          accountId: session.accountId,
          ids: [id]
        }, 'contact']
      ]
    };

    try {
      const response = await this.makeRequest(request);
      return response.methodResponses[0][1].list[0];
    } catch (error) {
      throw new Error(`Contact access not supported: ${error instanceof Error ? error.message : String(error)}. Try checking account permissions or enabling contacts API access in Fastmail settings.`);
    }
  }

  async searchContacts(query: string, limit: number = 20): Promise<any[]> {
    // Check permissions first
    const hasPermission = await this.checkContactsPermission();
    if (!hasPermission) {
      throw new Error('Contacts access not available. This account may not have JMAP contacts permissions enabled. Please check your Fastmail account settings or contact support to enable contacts API access.');
    }

    const session = await this.getSession();
    
    const request: JmapRequest = {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:contacts'],
      methodCalls: [
        ['Contact/query', {
          accountId: session.accountId,
          filter: { text: query },
          limit
        }, 'query'],
        ['Contact/get', {
          accountId: session.accountId,
          '#ids': { resultOf: 'query', name: 'Contact/query', path: '/ids' },
          properties: ['id', 'name', 'emails', 'phones', 'addresses', 'notes']
        }, 'contacts']
      ]
    };

    try {
      const response = await this.makeRequest(request);
      return response.methodResponses[1][1].list;
    } catch (error) {
      throw new Error(`Contact search not supported: ${error instanceof Error ? error.message : String(error)}. Try checking account permissions or enabling contacts API access in Fastmail settings.`);
    }
  }

}