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

Use `platformEnv` for platform detection:

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

### Available Platform Flags

```typescript
platformEnv.isNative      // React Native (iOS or Android)
platformEnv.isWeb         // Web browser
platformEnv.isDesktop     // Electron desktop app
platformEnv.isExtension   // Browser extension
platformEnv.isIOS         // iOS specifically
platformEnv.isAndroid     // Android specifically
platformEnv.isWebEmbed    // Embedded web components
```

## Key Principles

- UI components should work consistently across all platforms
- Keep platform-specific code in separate files with appropriate extensions
- Minimize platform-specific code by keeping common logic separate
- Test across all target platforms

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

## Conditional Platform Logic

```typescript
// ✅ GOOD: Use platformEnv
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

// ❌ BAD: Direct platform checks
if (typeof window !== 'undefined') { }
if (process.env.REACT_APP_PLATFORM === 'web') { }
```

## Platform-Specific Imports

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

## Checklist

- [ ] Platform-specific code uses correct file extension
- [ ] Uses `platformEnv` instead of direct checks
- [ ] Common logic extracted to shared files
- [ ] Tested on all target platforms
