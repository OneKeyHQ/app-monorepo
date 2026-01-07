// Re-export platform-specific OAuthPopup class
// The bundler will automatically select the correct file based on platform:
// - OAuthPopup.web.tsx for web
// - OAuthPopup.ext.tsx for browser extension
// - OAuthPopup.desktop.tsx for desktop (Electron)
// - OAuthPopup.native.tsx for native (iOS/Android)

export { OAuthPopup } from './OAuthPopup';

// Re-export types
export type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupOptions,
  IOAuthPopupResult,
  IOpenOAuthPopupOptions,
} from './types';

// Re-export base class for advanced use cases
export { OAuthPopupBase } from './OAuthPopupBase';
export type { IParsedOAuthStates } from './OAuthPopupBase';
