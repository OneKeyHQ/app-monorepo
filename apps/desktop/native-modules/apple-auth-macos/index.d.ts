/**
 * Native Apple Sign-In for macOS Electron apps
 */

export interface IAppleSignInResult {
  /** JWT identity token to send to Supabase signInWithIdToken */
  identityToken: string;
  /** Authorization code (for server-side validation) */
  authorizationCode?: string;
  /** Apple user identifier (stable across sign-ins) */
  user: string;
  /** User's email (only provided on first sign-in) */
  email?: string;
  /** User's full name (only provided on first sign-in) */
  fullName?: string;
  /** Raw nonce for Supabase validation */
  rawNonce: string;
}

/**
 * Check if Apple Sign-In is available.
 * Requires macOS 10.15 (Catalina) or later.
 * @returns True if available
 */
export function isAvailable(): boolean;

/**
 * Perform Apple Sign-In.
 * Shows native Apple Sign-In dialog and returns identity token.
 * @returns Promise resolving with sign-in result
 * @throws Error if sign-in fails or user cancels
 */
export function signIn(): Promise<IAppleSignInResult>;
