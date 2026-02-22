# Fastmail MCP Server

A Model Context Protocol (MCP) server that provides access to the Fastmail API, enabling AI assistants to interact with email, contacts, and calendar data.

## Features

### Core Email Operations
- List mailboxes and get mailbox statistics
- List, search, and filter emails with advanced criteria
- Get specific emails by ID with full content
- Send emails (text and HTML) with proper draft/sent handling
- Email management: mark read/unread, delete, move between folders

### Advanced Email Features
- **Attachment Handling**: List and download email attachments
- **Threading Support**: Get complete conversation threads
- **Advanced Search**: Multi-criteria filtering (sender, date range, attachments, read status)
- **Bulk Operations**: Process multiple emails simultaneously
- **Statistics & Analytics**: Account summaries and mailbox statistics

### Contacts Operations
- List all contacts with full contact information
- Get specific contacts by ID
- Search contacts by name or email

### Calendar Operations (CalDAV)
- List all calendars with names, colors, and IDs
- List calendar events with optional date-range filtering
- Get specific calendar events by URL
- Create new calendar events with participants and details

> Calendar access uses CalDAV (not JMAP) and requires separate credentials — see [Configuration](#configuration).

### Identity & Account Management
- List available sending identities
- Account summary with comprehensive statistics

## Setup

### Prerequisites
- Node.js 18+
- A Fastmail account
- A Fastmail API token (for email and contacts)
- A Fastmail app password (for calendar access via CalDAV)

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Configuration

1. Get your Fastmail API token:
   - Log in to Fastmail web interface
   - Go to Settings → Privacy & Security
   - Find "Connected apps & API tokens" section
   - Click "Manage API tokens"
   - Click "New API token"
   - Copy the generated token

2. Set environment variables:
   ```bash
   # Required for email and contacts
   export FASTMAIL_API_TOKEN="your_api_token_here"
   # Optional: customize base URL (defaults to https://api.fastmail.com)
   export FASTMAIL_BASE_URL="https://api.fastmail.com"

   # Required for calendar access (CalDAV — separate from the JMAP token)
   # Generate an app password in Fastmail → Settings → Privacy & Security → App Passwords
   export FASTMAIL_USERNAME="you@fastmail.com"
   export FASTMAIL_CALDAV_PASSWORD="your_app_password_here"
   ```

   > **Why two sets of credentials?** Fastmail exposes email and contacts via JMAP (using an API token) but calendars via CalDAV (using HTTP Basic auth with an app password). The two protocols require different credentials.

### Running the Server

Start the MCP server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Run via npx (GitHub)

Default to `main` branch:

```bash
FASTMAIL_API_TOKEN="your_token" FASTMAIL_BASE_URL="https://api.fastmail.com" \
  npx --yes github:MadLlama25/fastmail-mcp fastmail-mcp
```

Windows PowerShell:

```powershell
$env:FASTMAIL_API_TOKEN="your_token"
$env:FASTMAIL_BASE_URL="https://api.fastmail.com"
npx --yes github:MadLlama25/fastmail-mcp fastmail-mcp
```

Pin to a tagged release:

```bash
FASTMAIL_API_TOKEN="your_token" \
  npx --yes github:MadLlama25/fastmail-mcp@v1.6.1 fastmail-mcp
```

## Install as a Claude Desktop Extension (DXT)

You can install this server as a Desktop Extension for Claude Desktop using the packaged `.dxt` file.

1. Build and pack:
   ```bash
   npm run build
   npx dxt pack
   ```
   This produces `fastmail-mcp.dxt` in the project root.

2. Install into Claude Desktop:
   - Open the `.dxt` file, or drag it into Claude Desktop
   - When prompted:
     - Fastmail API Token: paste your token (stored encrypted by Claude)
     - Fastmail Base URL: leave blank to use `https://api.fastmail.com` (default)

3. Use any of the tools (e.g. `get_recent_emails`).

## Available Tools (31 Total)

**🎯 Most Popular Tools:**
- **check_function_availability**: Check what's available and get setup guidance  
- **test_bulk_operations**: Safely test bulk operations with dry-run mode
- **send_email**: Full-featured email sending with proper draft/sent handling
- **advanced_search**: Powerful multi-criteria email filtering
- **get_recent_emails**: Quick access to recent emails from any mailbox

### Email Tools

- **list_mailboxes**: Get all mailboxes in your account
- **list_emails**: List emails from a specific mailbox or all mailboxes
  - Parameters: `mailboxId` (optional), `limit` (default: 20)
- **get_email**: Get a specific email by ID
  - Parameters: `emailId` (required)
- **send_email**: Send an email
  - Parameters: `to` (required array), `cc` (optional array), `bcc` (optional array), `from` (optional), `mailboxId` (optional), `subject` (required), `textBody` (optional), `htmlBody` (optional)
- **search_emails**: Search emails by content
  - Parameters: `query` (required), `limit` (default: 20)
- **get_recent_emails**: Get the most recent emails from a mailbox (inspired by JMAP-Samples top-ten)
  - Parameters: `limit` (default: 10, max: 50), `mailboxName` (default: 'inbox')
- **mark_email_read**: Mark an email as read or unread
  - Parameters: `emailId` (required), `read` (default: true)
- **delete_email**: Delete an email (move to trash)
  - Parameters: `emailId` (required)
- **move_email**: Move an email to a different mailbox
  - Parameters: `emailId` (required), `targetMailboxId` (required)

### Advanced Email Features

- **get_email_attachments**: Get list of attachments for an email
  - Parameters: `emailId` (required)
- **download_attachment**: Get download URL for an email attachment
  - Parameters: `emailId` (required), `attachmentId` (required)
- **advanced_search**: Advanced email search with multiple criteria
  - Parameters: `query` (optional), `from` (optional), `to` (optional), `subject` (optional), `hasAttachment` (optional), `isUnread` (optional), `mailboxId` (optional), `after` (optional), `before` (optional), `limit` (default: 50)
- **get_thread**: Get all emails in a conversation thread
  - Parameters: `threadId` (required)

### Email Statistics & Analytics

- **get_mailbox_stats**: Get statistics for a mailbox (unread count, total emails, etc.)
  - Parameters: `mailboxId` (optional, defaults to all mailboxes)
- **get_account_summary**: Get overall account summary with statistics

### Bulk Operations

- **bulk_mark_read**: Mark multiple emails as read/unread
  - Parameters: `emailIds` (required array), `read` (default: true)
- **bulk_move**: Move multiple emails to a mailbox
  - Parameters: `emailIds` (required array), `targetMailboxId` (required)
- **bulk_delete**: Delete multiple emails (move to trash)
  - Parameters: `emailIds` (required array)

### Contact Tools

- **list_contacts**: List all contacts
  - Parameters: `limit` (default: 50)
- **get_contact**: Get a specific contact by ID
  - Parameters: `contactId` (required)
- **search_contacts**: Search contacts by name or email
  - Parameters: `query` (required), `limit` (default: 20)

### Calendar Tools

Calendar tools use CalDAV and require `FASTMAIL_USERNAME` and `FASTMAIL_CALDAV_PASSWORD`.

- **list_calendars**: List all calendars — returns `calendarId`, `calendarUrl`, `name`, `color`
- **list_calendar_events**: List events from a calendar
  - Parameters: `calendarId` (preferred, from `list_calendars`), `calendarUrl` (alternative), `timeRangeStart` (ISO 8601), `timeRangeEnd` (ISO 8601)
  - Always pass a time range to avoid fetching all events
- **get_calendar_event**: Get full details of a single event
  - Parameters: `eventId` (the `url` field from a `list_calendar_events` result)
- **create_calendar_event**: Create a new calendar event
  - Parameters: `calendarId` (preferred) or `calendarUrl`, `title` (required), `start` (required, ISO 8601), `end` (required, ISO 8601), `description` (optional), `location` (optional), `participants` (optional array of `{ email, name? }`)

### Identity & Testing Tools

- **list_identities**: List sending identities (email addresses that can be used for sending)
- **check_function_availability**: Check which functions are available based on account permissions (includes setup guidance)
- **test_bulk_operations**: Safely test bulk operations with dry-run mode
  - Parameters: `dryRun` (default: true), `limit` (default: 3)

## API Information

This server uses the JMAP (JSON Meta Application Protocol) API provided by Fastmail. JMAP is a modern, efficient alternative to IMAP for email access.

### Inspired by Fastmail JMAP-Samples

Many features in this MCP server are inspired by the official [Fastmail JMAP-Samples](https://github.com/fastmail/JMAP-Samples) repository, including:
- Recent emails retrieval (based on top-ten example)
- Email management operations
- Efficient chained JMAP method calls

### Authentication
The server uses bearer token authentication with Fastmail's API. API tokens provide secure access without exposing your main account password.

### Rate Limits
Fastmail applies rate limits to API requests. The server handles standard rate limiting, but excessive requests may be throttled.

## Development

### Project Structure
```
src/
├── index.ts              # stdio entry point (Claude Desktop, npx)
├── http-server.ts        # HTTP entry point (Fly.io / Poke)
├── server.ts             # MCP server factory — all tool definitions and handlers
├── auth.ts               # Fastmail JMAP authentication
├── jmap-client.ts        # JMAP API client (email, contacts)
├── caldav-client.ts      # CalDAV client (calendar access via tsdav)
├── contacts-calendar.ts  # JMAP contacts client
└── __tests__/            # vitest test suites (48 tests)
```

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure that:
1. Code follows the existing style
2. All functions are properly typed
3. Error handling is implemented
4. Documentation is updated for new features

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure your API token is valid and has the necessary permissions
2. **Missing Dependencies**: Run `npm install` to ensure all dependencies are installed  
3. **Build Errors**: Check that TypeScript compilation completes without errors using `npm run build`
4. **Calendar/Contacts "Forbidden" Errors**: Use `check_function_availability` to see setup guidance

### Calendar Not Working?

Calendar access uses CalDAV, not JMAP. If calendar tools fail, check:

1. **Missing credentials**: `FASTMAIL_USERNAME` and `FASTMAIL_CALDAV_PASSWORD` must both be set
2. **Wrong password type**: CalDAV requires an *app password* generated in Fastmail → Settings → Privacy & Security → App Passwords — not your account password or JMAP API token
3. **Check availability**: Run `check_function_availability` to confirm the credentials are detected

### Contacts Not Working?

Contacts use JMAP. If contacts tools return errors, `check_function_availability` will show whether the `urn:ietf:params:jmap:contacts` capability is available on your account.

### Testing Your Setup

Use the built-in testing tools:
- **check_function_availability**: See what's available and get setup help
- **test_bulk_operations**: Safely test bulk operations without making changes

For more detailed error information, check the console output when running the server.

## Privacy & Security

- API tokens are stored encrypted by Claude Desktop when installed via the DXT and are never logged by this server.
- The server avoids logging raw errors and sensitive data (tokens, email addresses, identities, attachment names/blobIds) in error messages.
- Tool responses may include your email metadata/content by design (e.g., listing emails) but internal identifiers and credentials are not disclosed beyond what Fastmail returns for the requested data.
- If you encounter errors, messages are sanitized and summarized to prevent leaking personal information.