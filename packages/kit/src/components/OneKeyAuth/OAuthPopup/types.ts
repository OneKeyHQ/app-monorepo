import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Session Persistence Types
// ============================================================================

export type IHandleOAuthSessionPersistenceParams = {
  accessToken: string;
  refreshToken: string;
};

// ============================================================================
// OAuth Result Types
// ============================================================================

export type IOAuthPopupResult = {
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

// ============================================================================
// OAuth Options Types
// ============================================================================

export type IOpenOAuthPopupOptions = {
  // Whether to persist the session to storage
  // When false (default): Only return tokens, don't call setSession
  persistSession?: boolean;
};

/**
 * OAuth configuration for Google sign-in (native iOS/Android).
 * These values should match your Google Cloud Console OAuth 2.0 Client ID settings.
 */
export interface INativeOAuthConfig {
  // Google OAuth Client ID for iOS
  // Create this in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
  // Application type: iOS
  iosClientId?: string;
  // Google OAuth Client ID for Android (Web client ID is used for Android)
  // Application type: Web application
  webClientId?: string;
  // OAuth scopes to request
  scopes?: string[];
}

/**
 * Unified OAuth popup options for all platforms
 */
export interface IOAuthPopupOptions {
  // The OAuth authorization URL to open
  authUrl?: string;
  // The OAuth redirect URL (with onekey_oauth_state if needed)
  // This should be the same URL passed to Supabase signInWithOAuth
  redirectTo?: string;
  // Supabase client instance (for code exchange)
  client?: SupabaseClient;
  // Function to handle session persistence after OAuth success
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  // Native-specific OAuth config (only used on native platform)
  nativeConfig?: INativeOAuthConfig;
}
