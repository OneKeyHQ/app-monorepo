import {
  isAppleAuthAvailable,
  signInWithApple,
} from '@onekeyhq/desktop/app/service/appleAuth/appleAuth';

import type { IDesktopApi } from './instance/IDesktopApi';

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
 * Desktop API for native Apple Sign-In (macOS only)
 *
 * Uses ASAuthorizationController from AuthenticationServices framework
 * to perform native Apple Sign-In without opening a browser.
 */
class DesktopApiAppleAuth {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  /**
   * Check if native Apple Sign-In is available.
   * Requires macOS 10.15+ and the native module to be built.
   */
  isAvailable(): boolean {
    return isAppleAuthAvailable();
  }

  /**
   * Perform native Apple Sign-In.
   *
   * @returns Promise with identity token and nonce for Supabase
   * @throws Error if sign-in fails or user cancels
   */
  async signIn(): Promise<IAppleSignInResult> {
    return signInWithApple();
  }
}

export default DesktopApiAppleAuth;
