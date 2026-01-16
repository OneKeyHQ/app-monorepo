---
name: remote-log-debugging
description: Remote logging and debugging tools for OneKey development. Use when setting up remote log server, debugging with remote logs, or using remoteLogger API. Triggers on remote log, debug, remoteLogger, log server, debugging tools.
allowed-tools: Read, Grep, Glob, Bash
---

# OneKey Remote Log Debugging

This skill helps with setting up and using the remote logging feature for debugging OneKey applications across platforms.

## Overview

The `remoteLogger` is a dedicated logging utility that sends logs to a local network server for debugging purposes. It does NOT intercept console.log - you must explicitly use the remoteLogger API.

## Security Restrictions

**CRITICAL**: For security reasons, the remote log server address is restricted to:
- `localhost` / `127.x.x.x` (loopback)
- `10.x.x.x` (Class A private network)
- `172.16.x.x` - `172.31.x.x` (Class B private network)
- `192.168.x.x` (Class C private network)
- IPv6 loopback (`::1`) and link-local (`fe80::`)

Public IP addresses and domain names are NOT allowed.

## Setup Instructions

### 1. Start the Log Server

First, you need a log server running locally. Example using a simple Node.js server:

```bash
# Create a simple log server
mkdir -p ~/onekey-log-server && cd ~/onekey-log-server

cat > server.js << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const log = JSON.parse(body);
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] [${log.level}] ${log.platform || 'unknown'}: ${log.message}`);
        if (log.meta) console.log('  Meta:', JSON.stringify(log.meta, null, 2));
      } catch (e) {
        console.log('Raw:', body);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  } else {
    res.writeHead(200);
    res.end('Log Server Running');
  }
});

server.listen(3300, () => console.log('Log server on http://localhost:3300'));
EOF

node server.js
```

### 2. Enable in Developer Settings

1. Open OneKey app
2. Go to Settings > Developer Mode (enable if not already)
3. Find "Remote Log" section
4. Toggle ON the "Remote Log" switch
5. Set server address (default: `http://localhost:3300`)

### 3. Using the remoteLogger API

Import and use in your code:

```typescript
import { remoteLogger } from '@onekeyhq/shared/src/logger/remoteLogger';

// Available methods - similar to console API
remoteLogger.debug('Debug message', { extra: 'data' });
remoteLogger.info('Info message');
remoteLogger.log('Log message');   // Same as info
remoteLogger.warn('Warning message');
remoteLogger.error('Error message', { errorCode: 123 });
```

### API Reference

```typescript
// Configuration
remoteLogger.enable(server?: string)  // Enable logging, optionally set server
remoteLogger.disable()                 // Disable logging
remoteLogger.isEnabled()               // Check if enabled
remoteLogger.getServer()               // Get current server URL
remoteLogger.setServer(server: string) // Set server URL

// Logging methods
remoteLogger.debug(...args: unknown[])  // DEBUG level
remoteLogger.info(...args: unknown[])   // INFO level
remoteLogger.log(...args: unknown[])    // INFO level (alias)
remoteLogger.warn(...args: unknown[])   // WARN level
remoteLogger.error(...args: unknown[])  // ERROR level
```

### Log Entry Format

Logs are sent as JSON to the server:

```json
{
  "level": "INFO",
  "message": "Your log message",
  "ts": "2024-01-15T10:30:00.000Z",
  "platform": "desktop",
  "meta": { "optional": "metadata" }
}
```

### Batch Logging

Logs are batched for efficiency:
- Logs are queued and flushed every 100ms
- Immediate flush when queue reaches 50 entries
- Single logs go to `/api/logs`
- Batched logs go to `/api/logs/batch`

## Validation Function

You can use `isLocalNetworkAddress` to validate URLs:

```typescript
import { isLocalNetworkAddress } from '@onekeyhq/shared/src/logger/remoteLogger';

isLocalNetworkAddress('http://localhost:3300');     // true
isLocalNetworkAddress('http://192.168.1.100:3300'); // true
isLocalNetworkAddress('http://10.0.0.1:3300');      // true
isLocalNetworkAddress('https://example.com');       // false
```

## File Locations

- Logger implementation: `packages/shared/src/logger/remoteLogger.ts`
- Service layer: `packages/kit-bg/src/services/ServiceDevSetting.ts`
- UI settings: `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/index.tsx`
- Atom state: `packages/kit-bg/src/states/jotai/atoms/devSettings.ts`

## Troubleshooting

### Logs not appearing on server
1. Check if remote logging is enabled in Developer Settings
2. Verify server address is a valid local network address
3. Ensure log server is running and accessible
4. Check network/firewall settings

### Server address rejected
- Only localhost and private IP ranges are allowed
- Public IPs and domain names will be rejected
- Check the address format: `http://host:port`

### Platform detection
The logger auto-detects platform: `ios`, `android`, `web`, `desktop`, `ext`
