# File Analysis Patterns

## Quick Commands for File Analysis

### Get list of changed files

```bash
git fetch origin && git diff --name-only origin/x...HEAD
```

### Get detailed diff stats

```bash
git diff --stat origin/x...HEAD
```

### Get changed files with line counts

```bash
git diff --numstat origin/x...HEAD
```

### Categorize files by type

```bash
# TypeScript/JavaScript files
git diff --name-only origin/x...HEAD | grep -E '\.(ts|tsx|js|jsx)$'

# Configuration files
git diff --name-only origin/x...HEAD | grep -E '\.(json|yaml|yml|config\.)'

# Test files
git diff --name-only origin/x...HEAD | grep -E '(\.test\.|\.spec\.|__tests__)'
```

## File Category Detection

### Security-Critical Patterns

Files matching these patterns require extra scrutiny:

- `**/auth/**` - Authentication logic
- `**/crypto/**` - Cryptographic operations
- `**/vault/**` - Secret storage
- `**/keys/**` - Key management
- `**/signing/**` - Transaction signing
- `**/*secret*` - Secret handling
- `**/*password*` - Password handling
- `**/*token*` - Token handling

### Network/API Patterns

- `**/api/**` - API definitions
- `**/services/**` - Service layer
- `**/*client*` - API clients
- `**/*request*` - Request handling
- `**/*fetch*` - Data fetching

### State Management Patterns

- `**/states/**` - State definitions
- `**/atoms/**` - Jotai atoms
- `**/store/**` - Store definitions
- `**/context/**` - React context
- `**/*reducer*` - Redux reducers

### UI Component Patterns

- `**/components/**` - Shared components
- `**/views/**` - View components
- `**/pages/**` - Page components
- `**/screens/**` - Screen components

## Dependency Analysis

### Find what imports a changed file

```bash
# Find files importing a specific module
grep -r "from.*'@onekeyhq/kit/src/changed-file'" --include="*.ts" --include="*.tsx"
```

### Trace import chain

```bash
# Find all imports in a file
grep -E "^import|from ['\"]" path/to/file.ts
```

## Risk Level Assessment

### Critical Risk Indicators

- Changes to `packages/core/src/` - Core crypto/blockchain
- Changes to `**/vault/**` - Secret management
- Changes to `**/signing/**` - Transaction signing
- Changes to hardware wallet SDK usage
- Changes to authentication flows

### High Risk Indicators

- New dependencies added
- Changes to API endpoints
- Changes to state management
- Changes to background services
- Platform-specific code changes

### Medium Risk Indicators

- UI component changes
- Style changes
- Test file changes
- Documentation changes

### Low Risk Indicators

- Comment changes
- Type-only changes
- Formatting changes

## Cross-Platform File Detection

### Platform-Specific Extensions

- `.native.ts` - React Native (iOS/Android)
- `.web.ts` - Web platform
- `.desktop.ts` - Desktop (Electron)
- `.ext.ts` - Browser extension

### Check platform impact

```bash
# Files with platform-specific variants
git diff --name-only origin/x...HEAD | sed 's/\.\(native\|web\|desktop\|ext\)\.ts/.ts/' | sort -u
```

## Package Boundary Analysis

### OneKey Package Hierarchy

```
@onekeyhq/shared     <- Base (imports nothing from OneKey)
    ↓
@onekeyhq/components <- UI (imports shared only)
    ↓
@onekeyhq/core       <- Blockchain (imports shared only)
    ↓
@onekeyhq/kit-bg     <- Background (imports shared, core)
    ↓
@onekeyhq/kit        <- App logic (imports all above)
    ↓
apps/*               <- Platform apps (imports all)
```

### Verify import hierarchy

```bash
# Check if kit-bg imports from components (FORBIDDEN)
grep -r "from.*@onekeyhq/components" packages/kit-bg/src/
```
