export type IHandleOAuthSessionPersistenceParams = {
  accessToken: string;
  refreshToken: string;
  persistSession?: boolean;
  // Whether to also login to Prime service (default: true)
  loginToPrime?: boolean;
};

export type IOAuthPopupResult = {
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

export type IOpenOAuthPopupOptions = {
  // Whether to persist the session to storage
  // When false (default): Only return tokens, don't call setSession
  persistSession?: boolean;
};

/**
 * OAuth configuration for Google sign-in (extension).
 * These values should match your Google Cloud Console OAuth 2.0 Client ID settings.
 */
export interface IExtensionOAuthConfig {
  // Google OAuth Client ID for Chrome Extension
  // Create this in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
  // Application type: Chrome Extension
  googleClientId: string;
  // OAuth scopes to request
  scopes?: string[];
}
