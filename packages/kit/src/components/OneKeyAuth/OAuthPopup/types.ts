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
 * Unified OAuth popup options for all platforms
 */
export interface IOAuthPopupOptions {
  // The OAuth provider (google, apple, etc.)
  provider?: 'google' | 'apple';
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
}
