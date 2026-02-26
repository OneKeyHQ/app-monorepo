# Crypto Wallet Security Patterns

Security reference specific to the OneKey wallet codebase. Use during Deep-mode reviews or whenever changes touch security-critical paths.

---

## 1. Secret Material Lifecycle

### Mnemonics / Seed Phrases
- MUST only exist in `packages/core/src/secret/` — never in UI/kit/kit-bg layers
- MUST be encrypted at rest with AES-256 (`encryptAsync` / `decryptAsync` from `encryptors/aes256`)
- MUST use `ensureSensitiveTextEncoded()` before any storage or transmission
- NEVER pass raw mnemonic strings through IPC, postMessage, or Redux/Jotai state
- NEVER log mnemonic content, even partially — grep for `console.log`, `defaultLogger`, `JSON.stringify` near mnemonic variables

### Private Keys
- Same rules as mnemonics
- Stored as `ICoreImportedCredentialEncryptHex` — always encrypted hex, never raw bytes
- Prefix convention: `|PK|` (imported), `|RP|` (HD recovery phrase)
- Verify the `EncryptPrefix*` constants are used consistently

### Hardware Wallet Communication
- Hardware SDK access MUST go through `CoreSDKLoader()` pattern — NEVER direct import from `@onekeyfe/hd-core`
- Hardware signing MUST remain in `KeyringHardware.ts` files within `packages/kit-bg/src/vaults/impls/`
- Hardware operations are background-only — NEVER call hardware SDK from UI/kit layer
- Verify device response validation: always check `response.success` before using `response.payload`

---

## 2. Trust Boundaries

```text
┌─────────────────────────────────────────────────┐
│                    UI Layer (kit)                │  ← Untrusted
│  Components, Views, Hooks                       │
├─────────────────────────────────────────────────┤
│              Background Layer (kit-bg)           │  ← Trusted
│  Services, Vaults, Keyrings                     │
├─────────────────────────────────────────────────┤
│              Core Layer (core)                   │  ← Trusted
│  Secret management, Crypto, Chain logic         │
├─────────────────────────────────────────────────┤
│              Hardware SDK                        │  ← External Trust
│  Device communication via USB/BLE               │
└─────────────────────────────────────────────────┘
```

Key rules:
- UI layer MUST NOT access secrets directly — always go through background services
- Background services validate all inputs from UI before processing
- Transaction signing happens ONLY in keyrings (background layer)
- Hardware wallet interaction is isolated in background process

---

## 3. WebView Security

OneKey uses WebViews for DApp browser and embedded content.

### Risks
- **Message injection**: Malicious DApp sending crafted postMessage to wallet
- **Origin spoofing**: WebView loading untrusted origins
- **Data exfiltration**: DApp accessing wallet state through bridge

### What to Check
- `postMessage` / `onMessage` handlers validate message origin and structure
- WebView URLs are allowlisted or properly scoped
- No wallet secrets (keys, seeds, passwords) are accessible from WebView context
- DApp permission model is enforced (connect, sign, send — each requires explicit approval)
- `WebViewWebEmbedProvider` and related components use proper sandboxing

---

## 4. Transaction Security

### Signing Flow
1. UI builds unsigned transaction → sends to background
2. Background validates transaction parameters (amounts, addresses, fees)
3. Keyring performs signing (software or hardware)
4. Signed transaction returned to UI for broadcast

### What to Check
- Transaction amounts/addresses are validated before signing
- Fee parameters are bounded (no unlimited fee)
- Address format validation per chain (no sending to wrong-chain address)
- Replay protection is in place where applicable
- Transaction data displayed to user matches what is actually signed

---

## 5. Platform-Specific Security

### Browser Extension (MV3)
- Content scripts have minimal permissions
- Background service worker has no DOM access (no XSS surface)
- `manifest.json` permissions follow least-privilege
- CSP blocks eval/inline scripts
- Message passing between content script ↔ background validates sender

### Mobile (React Native)
- Secrets stored in platform secure storage (Keychain/Keystore), not AsyncStorage
- App backgrounding clears sensitive data from memory
- Deep link handlers validate URL parameters
- Biometric auth guards sensitive operations

### Desktop (Electron)
- `nodeIntegration: false` and `contextIsolation: true` for renderer
- IPC handlers validate all arguments from renderer
- No `shell.openExternal` with user-controlled URLs without validation
- Auto-updater uses code signing verification

### Web
- No secrets in localStorage/sessionStorage — use memory only
- CORS configuration is restrictive
- CSP headers prevent XSS
- No sensitive data in URL parameters

---

## 6. Common Vulnerability Patterns

| Pattern | Example | Grep Pattern |
|---------|---------|-------------|
| Logging secrets | `console.log(mnemonic)` | `console\.(log\|warn\|error\|info).*(?:mnemonic\|seed\|private\|secret\|password)` |
| Raw key in state | `setState({ privateKey })` | `setState.*(?:private\|secret\|mnemonic\|seed)` |
| Unvalidated WebView msg | `onMessage(e => doThing(e.data))` | `onMessage.*=>` without origin check |
| Unbounded transaction | `fee: userInput` | Assignment of user input to fee/amount without validation |
| Direct hardware import | `import { ... } from '@onekeyfe/hd-core'` | `from ['"]@onekeyfe/hd-core['"]` |
| Unsafe IPC | `ipcMain.handle('*', (_, data) => ...)` | `ipcMain\.(handle\|on)` without argument validation |
| Eval usage | `eval(userCode)` | `eval\(\|new Function\(` |

---

## 7. Review Escalation Triggers

If ANY of the following are true, escalate to a **Deep** review and consider requesting additional human security review:

- Changes to `packages/core/src/secret/`
- Changes to any `Keyring*.ts` file
- Changes to `manifest.json` permissions
- New dependency with native bindings
- Changes to WebView message handling
- Changes to transaction signing flow
- Changes to authentication/password/biometric logic
- Changes to IPC handlers (desktop)
