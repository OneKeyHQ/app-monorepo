# Network Doctor 🩺

React Native network diagnostics library - Professional, configurable, and easy to integrate

**IMPORTANT**: This module is **ONLY available on native platforms** (iOS/Android). Web/Desktop/Extension platforms only have access to type definitions.

## Features

- ✅ **Configuration-driven** - All parameters externally provided, flexible and customizable
- ✅ **Dependency injection** - Custom logger and headers generator
- ✅ **Type-safe** - Complete TypeScript type definitions
- ✅ **Layered diagnostics** - DNS, TCP, TLS, HTTP comprehensive detection
- ✅ **Intelligent analysis** - Automatically identifies SNI blocking, DNS pollution, and other issues
- ✅ **Structured reports** - Clear diagnostic reports and issue analysis
- ✅ **Maintainable** - Modular design, easy to extend

## Installation

All dependencies are already installed in the OneKey monorepo:

```bash
# Dependencies (already installed):
# - @react-native-community/netinfo
# - react-native-dns-lookup
# - react-native-network-logger
# - react-native-ping
# - react-native-tcp-socket
# - react-native-network-info
# - axios
```

## Quick Start

### Basic Usage

```typescript
import { runNetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';

const report = await runNetworkDoctor({
  targetDomain: 'wallet.onekeytest.com',
});

console.log('Network Status:', report.summary.assessment);
// Output: "healthy" | "degraded" | "blocked"
```

### Full Configuration

```typescript
import { runNetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';
import { myLogger } from './logger';

const report = await runNetworkDoctor({
  // Required: target domain
  targetDomain: 'wallet.onekeytest.com',

  // Optional: health check path (default '/health')
  healthCheckPath: '/wallet/v1/health',

  // Optional: dynamic headers generator
  headersGenerator: async () => ({
    'Authorization': `Bearer ${await getToken()}`,
    'X-Request-ID': generateRequestId(),
    'X-Device-ID': getDeviceId(),
  }),

  // Optional: custom logger
  logger: {
    debug: (msg, data) => myLogger.debug(msg, data),
    info: (msg, data) => myLogger.info(msg, data),
    warn: (msg, data) => myLogger.warn(msg, data),
    error: (msg, data) => myLogger.error(msg, data),
  },

  // Optional: timeout configuration (milliseconds)
  timeouts: {
    dns: 10000,
    tcp: 10000,
    tls: 10000,
    http: 10000,
    ping: 5000,
  },

  // Optional: extra ping targets
  extraPingTargets: ['1.1.1.1', '8.8.8.8', 'custom.server.com'],

  // Optional: extra HTTP probe endpoints
  extraHttpProbes: [
    { label: 'api_status', url: 'https://api.example.com/status' },
  ],

  // Optional: enable network logging (default true)
  enableNetworkLogger: true,

  // Optional: maximum network logs (default 1000)
  maxNetworkLogs: 500,
});
```

## Platform Support

### Native Platforms (iOS/Android) ✅

Full functionality available:

```typescript
import { runNetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';

const report = await runNetworkDoctor({
  targetDomain: 'wallet.onekeytest.com',
});
```

### Non-Native Platforms (Web/Desktop/Extension) ⚠️

Only type definitions available. The actual implementation is not included to avoid importing native modules during compilation.

```typescript
// Only type imports work
import type { NetworkCheckup, DoctorConfig } from '@onekeyhq/shared/src/modules/NetworkDoctor';

// Runtime execution will fail - Network Doctor is not available on this platform
```

## API Reference

### `runNetworkDoctor(config)`

Run complete network diagnostics and return a detailed report.

**Parameters:**

```typescript
interface DoctorConfig {
  targetDomain: string;                   // Required: target domain
  healthCheckPath?: string;               // Optional: health check path
  headersGenerator?: HeadersGenerator;    // Optional: headers generator
  logger?: DoctorLogger;                  // Optional: custom logger
  timeouts?: { ... };                     // Optional: timeout configuration
  extraPingTargets?: string[];            // Optional: extra ping targets
  extraHttpProbes?: Array<{...}>;         // Optional: extra HTTP probes
  enableNetworkLogger?: boolean;          // Optional: enable network logging
  maxNetworkLogs?: number;                // Optional: log count limit
}
```

**Return Value:**

```typescript
interface NetworkCheckup {
  timestamp: string;

  config: {
    targetDomain: string;
    healthCheckUrl: string;
  };

  summary: {
    allCriticalChecksPassed: boolean;
    issues: DiagnosticIssue[];
    assessment: 'healthy' | 'degraded' | 'blocked';
  };

  results: {
    netInfo: NetInfoSnapshot;
    networkEnv: NetworkEnvironment;
    dns: DnsResult;
    tcpTests: ConnectivityComparison;
    tlsTest: TlsHandshakeResult;
    pingDomain: PingResult;
    pingIp?: PingResult;
    extraPings: PingResult[];
    healthCheck: HttpProbeResult;
    publicHttpChecks: HttpProbeResult[];
    networkLogs: NetworkRequestLog[];
  };

  metrics: {
    totalDurationMs: number;
    dnsResolutionMs?: number;
    tcpHandshakeMs?: number;
    tlsHandshakeMs?: number;
    httpRequestMs?: number;
  };
}
```

## Usage Scenarios

### Scenario 1: Diagnose SNI Blocking for Japanese Users

```typescript
import { runNetworkDoctor, DiagnosticIssueType } from '@onekeyhq/shared/src/modules/NetworkDoctor';

const report = await runNetworkDoctor({
  targetDomain: 'wallet.onekeytest.com',
  healthCheckPath: '/wallet/v1/health',
});

if (report.summary.assessment === 'blocked') {
  const sniIssue = report.summary.issues.find(
    (issue) => issue.type === DiagnosticIssueType.SELECTIVE_BLOCKING
  );

  if (sniIssue) {
    // SNI blocking detected!
    console.error('SNI Blocking detected!');
    console.log('Suggested solutions:', sniIssue.suggestedSolutions);

    // Switch to backup strategy
    await switchToAlternativeDomain();
  }
}
```

### Scenario 2: Auto-diagnose on App Start

```typescript
import { runNetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';
import { uploadToServer } from './analytics';

// Run on app startup
useEffect(() => {
  async function checkNetwork() {
    const report = await runNetworkDoctor({
      targetDomain: 'wallet.onekeytest.com',
      headersGenerator: async () => ({
        'X-User-ID': userId,
        'X-Country': userCountry,
      }),
    });

    // Upload diagnostic data to server
    await uploadToServer({
      userId,
      country: userCountry,
      assessment: report.summary.assessment,
      issues: report.summary.issues,
      timestamp: report.timestamp,
    });

    // If there are issues, notify the user
    if (!report.summary.allCriticalChecksPassed) {
      Alert.alert(
        'Network Issue Detected',
        'We detected network connectivity issues. Trying alternative connection...'
      );
    }
  }

  void checkNetwork();
}, []);
```

## Report Interpretation

### Summary Field

```typescript
summary: {
  // Whether all critical checks passed
  allCriticalChecksPassed: false,

  // List of detected issues
  issues: [
    {
      type: 'SELECTIVE_BLOCKING',
      severity: 'critical',
      message: 'Selective blocking detected...',
      details: [...],
      suggestedSolutions: [...]
    }
  ],

  // Overall assessment
  assessment: 'blocked'  // 'healthy' | 'degraded' | 'blocked'
}
```

### Issue Types

| Type | Description | Severity |
|------|------|----------|
| `SELECTIVE_BLOCKING` | SNI blocking or selective filtering | critical |
| `DNS_FAILURE` | DNS resolution failed | critical |
| `TCP_FAILURE` | TCP connection failed | warning/info |
| `TLS_FAILURE` | TLS handshake failed | critical |
| `HTTP_FAILURE` | HTTP request failed | critical |
| `CERTIFICATE_ERROR` | Certificate error | warning |
| `PING_BLOCKED` | Ping blocked (usually normal) | info |

### Assessment Evaluation

- **`healthy`** - All tests passed, network is normal
- **`degraded`** - Warning-level issues exist, but basic functionality works
- **`blocked`** - Critical issues exist, network is unavailable

## Best Practices

### 1. Set Reasonable Timeouts

```typescript
const report = await runNetworkDoctor({
  targetDomain: 'wallet.onekeytest.com',
  timeouts: {
    dns: 5000,    // DNS is usually fast
    tcp: 8000,    // TCP handshake
    tls: 10000,   // TLS can be slower
    http: 15000,  // HTTP request includes data transfer
    ping: 3000,   // Ping should be quick
  },
});
```

### 2. Use Headers Generator for Dynamic Authentication

```typescript
const report = await runNetworkDoctor({
  targetDomain: 'wallet.onekeytest.com',
  headersGenerator: async () => {
    // Dynamically get the latest token for each request
    const token = await getLatestToken();

    return {
      'Authorization': `Bearer ${token}`,
      'X-Request-ID': uuid.v4(),
      'X-Timestamp': Date.now().toString(),
    };
  },
});
```

### 3. Error Handling

```typescript
try {
  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
  });

  // Handle report
  handleReport(report);
} catch (error) {
  // Diagnostics itself failed (very rare)
  console.error('Diagnostics failed:', error);

  // Fallback handling
  await fallbackNetworkCheck();
}
```

## Architecture

```
packages/shared/src/modules/NetworkDoctor/
├── types.ts                    # Type definitions (no imports)
├── config.ts                   # Configuration management
├── NetworkDoctor.native.ts     # Core diagnostic class (native modules)
├── doctor.native.ts            # Functional API
├── examples.native.ts          # Usage examples
├── index.ts                    # Universal entry (types only)
├── index.native.ts             # Native entry (full functionality)
└── README.md                   # This file
```

## Common Questions

### Q: Why does ping fail but HTTPS succeeds?

A: This is normal. Many CDNs (like CloudFlare) block ICMP ping as a DDoS protection measure. As long as HTTPS requests succeed, the network is working.

### Q: How to determine if it's SNI blocking?

A: Check the `issues` array in the report. If it contains an issue of type `SELECTIVE_BLOCKING`, and `tcpTests.isSelectiveBlocking` is `true`, while both TLS and HTTP fail, then it's SNI blocking.

### Q: How long does diagnostics take?

A: Typically 10-15 seconds. You can view the actual duration via `report.metrics.totalDurationMs`.

### Q: How to reduce diagnostic time?

A: Adjust timeout configuration and reduce extra ping targets and HTTP probe endpoints.

## License

MIT

## Maintainers

OneKey Team
