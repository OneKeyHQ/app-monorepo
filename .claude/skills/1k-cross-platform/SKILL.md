---
name: 1k-cross-platform
description: Cross-platform development patterns for OneKey. Use when writing platform-specific code, handling platform differences, or working with native/web/desktop/extension platforms. Triggers on platform, native, web, desktop, extension, iOS, Android, Electron, platformEnv, .native.ts, .web.ts, .desktop.ts, .ext.ts, cross-platform, multi-platform.
allowed-tools: Read, Grep, Glob
---

# Cross-Platform Development

Patterns for writing platform-specific code in OneKey.

## Platform Extensions

Use platform extensions for platform-specific implementations:

| Extension | Platform |
|-----------|----------|
| `.native.ts` | React Native (iOS/Android) |
| `.web.ts` | Web platform |
| `.desktop.ts` | Desktop (Electron) |
| `.ext.ts` | Browser extension |

## Platform Detection

**ALWAYS use `platformEnv` for platform detection:**

```typescript
// ✅ CORRECT
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

// ❌ FORBIDDEN - Direct platform checks
if (typeof window !== 'undefined') { }
if (process.env.REACT_APP_PLATFORM === 'web') { }
```

## Available Platform Flags

```typescript
platformEnv.isNative      // React Native (iOS or Android)
platformEnv.isWeb         // Web browser
platformEnv.isDesktop     // Electron desktop app
platformEnv.isExtension   // Browser extension
platformEnv.isIOS         // iOS specifically
platformEnv.isAndroid     // Android specifically
platformEnv.isWebEmbed    // Embedded web components
```

## Platform-Specific File Structure

```
MyComponent/
├── index.ts              # Main entry, common logic
├── MyComponent.tsx       # Shared component
├── MyComponent.native.tsx    # React Native specific
├── MyComponent.web.tsx       # Web specific
├── MyComponent.desktop.tsx   # Desktop specific
└── MyComponent.ext.tsx       # Extension specific
```

The bundler automatically resolves the correct file based on platform.

## Example: Platform-Specific Storage

```typescript
// storage.ts - shared interface
export interface IStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// storage.native.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage: IStorage = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
};

// storage.web.ts
export const storage: IStorage = {
  get: async (key) => localStorage.getItem(key),
  set: async (key, value) => localStorage.setItem(key, value),
};

// storage.desktop.ts
import { ipcRenderer } from 'electron';

export const storage: IStorage = {
  get: (key) => ipcRenderer.invoke('storage:get', key),
  set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
};
```

## Detailed Guide

For comprehensive cross-platform patterns and platform considerations, see [cross-platform.md](references/rules/cross-platform.md).

Topics covered:
- Platform extensions and file structure
- Platform detection with `platformEnv`
- Platform-specific imports
- Platform considerations (Extension, Mobile, Desktop, Web)
- Real-world examples
- Cross-platform checklist

## Platform Considerations

### Extension (Chrome, Firefox, Edge, Brave)
- MV3/service worker lifetimes, permissions, CSP, background script limitations

### Mobile (iOS/Android)
- WebView limitations, native modules, background/foreground states, deep linking

### Desktop (Electron)
- Security boundaries, IPC communication, file system access

### Web
- CORS restrictions, storage limitations, XSS prevention, bundle size

## Checklist

- [ ] Platform-specific code uses correct file extension
- [ ] Uses `platformEnv` instead of direct checks
- [ ] Common logic extracted to shared files
- [ ] Tested on all target platforms

## Related Skills

- `/1k-coding-patterns` - General coding patterns
- `/1k-architecture` - Project structure and imports
