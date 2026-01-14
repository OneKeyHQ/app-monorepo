---
name: 1k-cross-platform
description: Cross-platform development patterns for OneKey. Use when writing platform-specific code, handling platform differences, or understanding platform extensions. Triggers on platform, native, web, desktop, extension, mobile, ios, android, electron, react native.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# OneKey Cross-Platform Development

## Platform Extensions

Use platform extensions for platform-specific implementations:
- `.native.ts` for React Native (iOS/Android)
- `.web.ts` for web platform
- `.desktop.ts` for desktop platform
- `.ext.ts` for browser extension

## Platform Detection

Use `import platformEnv from '@onekeyhq/shared/src/platformEnv'` for platform detection:

```typescript
import platformEnv from '@onekeyhq/shared/src/platformEnv';

if (platformEnv.isNative) {
  // React Native specific code
}

if (platformEnv.isWeb) {
  // Web specific code
}

if (platformEnv.isDesktop) {
  // Desktop (Electron) specific code
}

if (platformEnv.isExtension) {
  // Browser extension specific code
}
```

## Key Principles

- UI components should work consistently across all platforms
- Keep platform-specific code in separate files with appropriate extensions
- Minimize platform-specific code by keeping common logic separate
- Test across all target platforms

## Common Patterns

### Platform-Specific File Structure
```
MyComponent/
├── index.ts          # Main entry, common logic
├── MyComponent.tsx   # Shared component
├── MyComponent.native.tsx  # React Native specific
├── MyComponent.web.tsx     # Web specific
├── MyComponent.desktop.tsx # Desktop specific
└── MyComponent.ext.tsx     # Extension specific
```

### Conditional Platform Logic
```typescript
// GOOD: Use platformEnv
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function getStoragePath() {
  if (platformEnv.isNative) {
    return 'file://...';
  }
  if (platformEnv.isDesktop) {
    return '/path/to/storage';
  }
  return 'indexeddb://...';
}

// BAD: Direct platform checks
if (typeof window !== 'undefined') { } // ❌
if (process.env.REACT_APP_PLATFORM === 'web') { } // ❌
```

### Platform-Specific Imports
```typescript
// index.ts - Auto-resolves based on platform
export * from './MyComponent';

// The bundler will automatically pick:
// - MyComponent.native.ts on mobile
// - MyComponent.web.ts on web
// - MyComponent.desktop.ts on desktop
// - MyComponent.ext.ts on extension
```

## Platform Considerations

### Extension (Chrome, Firefox, Edge, Brave)
- MV3/service worker lifetimes
- Permissions and CSP
- Background script limitations
- Cross-origin restrictions

### Mobile (iOS/Android)
- WebView limitations
- Native modules
- Background/foreground states
- Deep linking

### Desktop (Electron)
- Security boundaries
- IPC communication
- nodeIntegration settings
- File system access

### Web
- CORS restrictions
- Storage limitations (localStorage, IndexedDB)
- XSS prevention
- Bundle size optimization
