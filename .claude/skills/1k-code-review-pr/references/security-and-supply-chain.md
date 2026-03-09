# Security & Supply-Chain Review

## 1. Secrets / PII Leakage

This is a crypto wallet — any secret leakage can result in fund loss. Check ALL exfiltration paths:

**Exfil sinks to inspect:**
- `console.*`, logging utilities, analytics SDKs, error reporting (Sentry)
- Network requests (fetch, axios, WebSocket)
- Web: localStorage / IndexedDB
- RN: AsyncStorage / secure storage
- Desktop: filesystem / keychain / sqlite

**What must NEVER leak:**
- Mnemonics / seed phrases / private keys / signing payloads
- API keys / tokens / cookies / session IDs
- Addresses tied to identity / any PII

**When you find a potential leak, document:**
- **Source**: what sensitive data
- **Sink**: where it goes (log? network? storage?)
- **Trigger**: when it happens
- **Impact**: who/what is exposed
- **Fix**: concrete remediation

```bash
# Grep for potential leaks in changed files
git diff origin/x...HEAD --name-only | xargs grep -n -E \
  "mnemonic|seed|private.?key|secret|password|token|apiKey|cookie|session" 2>/dev/null
```

## 2. AuthN / AuthZ

- Verify authentication guards wrap every protected route — no bypass paths
- Verify authorization checks (roles/permissions) are correct and consistent
- Server/client trust boundary: never trust client input for authorization decisions
- Check for authentication state that persists incorrectly across account switches

## 3. Supply-Chain Security

When `package.json` or lockfiles changed, you MUST do ALL of these:

### 3.1 Enumerate Changes
List every added/updated/removed dependency with **name + from→to version**.

### 3.2 Ecosystem Risk Check
For each changed package, check:
- Recent maintainer/ownership changes
- Suspicious release cadence
- Known advisories/CVEs
- Typosquatting risk (similar package names)

```bash
npm view <pkg> time maintainers repository dist.tarball
```

### 3.3 Source Inspection (node_modules)
Inspect `node_modules/<pkg>/package.json` and entrypoints. Grep for:

| Category | Patterns |
|----------|----------|
| **Outbound/network** | `fetch(`, `axios`, `XMLHttpRequest`, `http.request`, `https.request`, `WebSocket`, `net.`, `dns.` |
| **Dynamic execution** | `eval(`, `new Function`, `vm.runIn`, `child_process`, `spawn(`, `exec(` |
| **Install hooks** | `postinstall`, `preinstall`, `node-pre-gyp`, `prebuild`, `download`, `curl`, `wget` |
| **Privilege access** | filesystem, clipboard, keychain/keystore, environment variables |

**HIGH RISK — block unless justified:**
- Any telemetry / remote config fetch / unexpected outbound requests
- Any dynamic execution or install-time script behavior
- Any access to sensitive storage or wallet-related data

### 3.4 React Native Native-Layer Inspection
For RN packages with native bindings (`.podspec`, `ios/`, `android/`, `react-native.config.js`, TurboModules):
- Inspect iOS/Android native sources for hidden network calls, telemetry, or wallet data access
- Check CocoaPods/Gradle dependencies for transitive risks
- Treat obfuscated native code as HIGH RISK

## 4. Outbound Request Callout

If `node_modules` code performs ANY outbound request, document:
- **Call site**: exact file path + function
- **Destination**: full URL/host
- **Payload**: what data is sent
- **Headers/auth**: tokens/cookies/identifiers attached
- **Trigger**: when/how it runs
- **Cross-platform impact**: which platforms affected

## 5. Extension Manifest Permissions

If `manifest.json` permissions change (`permissions`, `host_permissions`, `optional_permissions`):
- Flag as **top review item**
- Enumerate added/removed permissions and what they enable
- Confirm least-privilege: strictly necessary, minimal host scope
- Re-check data exposure surfaces introduced by the change

## 6. Bulk Operations Security

### File upload without size limits
```typescript
// Bad: could be gigabytes
const content = await file.text();

// Good: check size first
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
if (file.size > MAX_SIZE) throw new Error('File too large');
```

### Hardcoded contract addresses
```typescript
// Risk: wrong address = lost funds. Verify checksum.
import { getAddress } from 'ethers';
const CONTRACT = getAddress('0x123...');  // Throws if invalid
```

### User input in batch operations
Validate each value — don't trust `.split(',').map(Number)` blindly.
