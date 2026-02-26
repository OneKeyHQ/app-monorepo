# Dependency Audit Reference

## Audit Workflow

### Step 1: Enumerate changes

```bash
# Show dependency diffs
git diff origin/x...HEAD -- package.json
git diff origin/x...HEAD -- yarn.lock pnpm-lock.yaml package-lock.json

# List only added/removed/changed packages (yarn.lock)
git diff origin/x...HEAD -- yarn.lock | grep -E '^\+|^\-' | grep -E '".*@' | head -40
```

### Step 2: Inspect package metadata

```bash
npm view <pkg> version time maintainers repository dist.tarball
npm view <pkg> scripts  # Check for install hooks
```

Red flags:
- Single maintainer with recent ownership transfer
- Suspiciously frequent releases (multiple per day)
- No repository field or repository URL mismatch
- Package name similar to popular package (typosquatting)

### Step 3: Source inspection (node_modules)

```bash
# Locate entrypoints
cat node_modules/<pkg>/package.json | grep -E '"main"|"module"|"exports"|"types"'

# Check for install hooks
cat node_modules/<pkg>/package.json | grep -E '"preinstall"|"postinstall"|"install"|"prepare"'
```

---

## Grep Patterns for High-Risk Behavior

### Outbound / Telemetry
```
fetch\(|axios|XMLHttpRequest|http\.request|https\.request|new WebSocket|ws|request\(|net\.|dns\.
```

### Dynamic Execution
```
eval\(|new Function|vm\.runIn|Function\(|child_process|spawn\(|exec\(
```

### Install Hooks / Binaries
```
postinstall|preinstall|install|node-pre-gyp|prebuild|download|curl|wget
```

### Environment / Secret Access
```
process\.env|keychain|keytar|keystore|clipboard|electron\.safeStorage
```

### Filesystem Access
```
fs\.(read|write|mkdir|rm|unlink|access)|readFileSync|writeFileSync|createReadStream|createWriteStream
```

---

## React Native Native Layer Inspection

For RN dependencies with native bindings (`.podspec`, `ios/`, `android/`, `react-native.config.js`):

### iOS (CocoaPods)
```bash
# Find native source files
find node_modules/<pkg>/ios -name "*.m" -o -name "*.mm" -o -name "*.swift" 2>/dev/null

# Check for network calls in native code
grep -rn "NSURLSession\|URLRequest\|AFNetworking\|Alamofire" node_modules/<pkg>/ios/

# Check for keychain/security access
grep -rn "SecItem\|kSecClass\|KeychainWrapper" node_modules/<pkg>/ios/

# Check Podspec for vendored frameworks
cat node_modules/<pkg>/*.podspec | grep -E "vendored|dependency|subspec"
```

### Android (Gradle/Maven)
```bash
# Find native source files
find node_modules/<pkg>/android -name "*.java" -o -name "*.kt" 2>/dev/null

# Check for network calls
grep -rn "HttpURLConnection\|OkHttp\|Retrofit\|Volley" node_modules/<pkg>/android/

# Check for keystore/crypto access
grep -rn "KeyStore\|KeyGenerator\|Cipher\|SecretKey" node_modules/<pkg>/android/

# Check build.gradle for hidden dependencies
cat node_modules/<pkg>/android/build.gradle | grep -E "implementation|api|compile"
```

---

## Known High-Risk Dependency Categories

| Category | Risk | Examples |
|----------|------|---------|
| Crypto libraries | Key/seed material handling | `bip39`, `@noble/*`, `tweetnacl` |
| Native modules | Platform-level access | `react-native-keychain`, `react-native-biometrics` |
| WebView/browser | XSS, injection surface | `react-native-webview`, any postMessage bridge |
| Network clients | Data exfiltration | `axios`, `node-fetch`, custom HTTP clients |
| Build tools with hooks | Supply-chain attack vector | Any package with `postinstall` scripts |
| Serialization | Deserialization attacks | `js-yaml`, `serialize-javascript` |

---

## Decision Matrix

| Finding | Action |
|---------|--------|
| Package has `postinstall` script that downloads binaries | **P0 — Block** unless explicitly justified |
| Package makes outbound requests not related to its stated purpose | **P0 — Block** |
| New native dependency accesses keychain/keystore | **P0 — Deep review** of native source |
| Package has single maintainer, <100 weekly downloads | **P1 — Flag** for human review |
| Major version bump of crypto-related package | **P1 — Verify** changelog and diff |
| Minor/patch update of well-known package | **P3 — Low risk** |
