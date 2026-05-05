import {
  OAUTH_FLOW_TIMEOUT_MS,
  ONEKEY_OAUTH_STATE_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Parsed States Type
// ============================================================================

export interface IParsedOAuthStates {
  // Supabase OAuth state (anti-CSRF)
  expectedState: string | null;
  // OneKey custom state (defense-in-depth)
  expectedOneKeyState: string | null;
}

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for OAuth popup implementations.
 *
 * Each platform (web, ext, desktop, native) extends this class
 * and implements the abstract methods.
 */
export abstract class OAuthPopupBase {
  // ============ Abstract Methods (platforms must implement) ============

  /**
   * Get the OAuth redirect URL for this platform.
   * Some platforms return a Promise (e.g., desktop needs to start a server first).
   */
  static getRedirectUrl(): Promise<string> {
    throw new OneKeyLocalError(
      'OAuthPopupBase.getRedirectUrl() must be implemented by platform',
    );
  }

  /**
   * Open OAuth popup and return result.
   * Platform implementations handle the OAuth flow internally.
   */
  static open(_options: IOAuthPopupOptions): Promise<IOAuthPopupResult> {
    throw new OneKeyLocalError(
      'OAuthPopupBase.open() must be implemented by platform',
    );
  }

  // ============ Protected Shared Utilities ============

  /**
   * Parse expected states from Supabase OAuth URL.
   *
   * Extracts:
   * - Supabase state parameter (for CSRF protection)
   * - OneKey custom state from redirect_to URL (defense-in-depth)
   */
  protected static parseExpectedStates(authUrl: string): IParsedOAuthStates {
    try {
      const authUrlObj = new URL(authUrl);
      const expectedState = authUrlObj.searchParams.get('state');

      // Parse our own state from the embedded redirect_to URL
      let expectedOneKeyState: string | null = null;
      const redirectTo = authUrlObj.searchParams.get('redirect_to');
      if (redirectTo) {
        try {
          const redirectToUrl = new URL(redirectTo);
          expectedOneKeyState = redirectToUrl.searchParams.get(
            ONEKEY_OAUTH_STATE_KEY,
          );
        } catch {
          expectedOneKeyState = null;
        }
      }

      return { expectedState, expectedOneKeyState };
    } catch {
      return { expectedState: null, expectedOneKeyState: null };
    }
  }

  /**
   * Validate OneKey custom state parameter (defense-in-depth).
   * Throws if validation fails.
   */
  protected static validateOneKeyState(
    expectedState: string | null,
    actualState: string | null,
  ): void {
    if (!expectedState) {
      throw new OneKeyLocalError('Expected OneKey OAuth state is missing');
    }
    if (!actualState) {
      throw new OneKeyLocalError('OAuth state is missing');
    }
    if (actualState !== expectedState) {
      throw new OneKeyLocalError('OAuth state mismatch');
    }
  }

  /**
   * Validate Supabase OAuth state parameter (anti-CSRF).
   * Only validates if expectedState is provided.
   * Throws if validation fails.
   */
  protected static validateSupabaseState(
    expectedState: string | null,
    actualState: string | null,
  ): void {
    if (expectedState) {
      if (!actualState) {
        throw new OneKeyLocalError('OAuth state is missing');
      }
      if (actualState !== expectedState) {
        throw new OneKeyLocalError('OAuth state mismatch');
      }
    }
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds.
   */
  protected static createTimeoutPromise(
    ms: number = OAUTH_FLOW_TIMEOUT_MS,
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new OneKeyLocalError('OAuth sign-in timed out'));
      }, ms);
    });
  }

  /**
   * Race a promise against timeout.
   * Returns the promise result or throws timeout error.
   */
  protected static async withTimeout<T>(
    promise: Promise<T>,
    ms: number = OAUTH_FLOW_TIMEOUT_MS,
  ): Promise<T> {
    return Promise.race([promise, this.createTimeoutPromise(ms)]);
  }

  /**
   * Exchange authorization code for session using Supabase PKCE flow.
   * The Supabase client automatically uses the stored code_verifier.
   */
  protected static async exchangeCodeForSession(
    client: SupabaseClient,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { data, error } = await client.auth.exchangeCodeForSession(code);

    if (error) {
      throw new OneKeyLocalError(error.message);
    }

    if (!data.session) {
      throw new OneKeyLocalError(
        'Failed to exchange authorization code for session',
      );
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * Wrap error with OneKeyLocalError if not already.
   */
  protected static wrapError(error: unknown, fallbackMessage: string): Error {
    // if (error instanceof OneKeyLocalError) {
    if (error instanceof OneKeyLocalError || error instanceof OneKeyError) {
      return error;
    }
    return new OneKeyLocalError(
      error instanceof Error ? error.message : fallbackMessage,
    );
  }

  /**
   * Check if error indicates user cancelled OAuth.
   */
  protected static isUserCancelledError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('The user did not approve') ||
        error.message.includes('cancelled') ||
        error.message.includes('canceled')
      );
    }
    return false;
  }
}
