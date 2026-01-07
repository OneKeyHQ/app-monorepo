import axios from 'axios';
import { isNil } from 'lodash';

import {
  JUICEBOX_ALLOWED_GUESSES,
  JUICEBOX_AUTH_SERVER,
  JUICEBOX_CONFIG,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { Client, Configuration } from './juicebox-sdk';

/**
 * JuiceboxClient - Wrapper for juicebox-sdk to handle keyless wallet shares
 *
 * This class provides methods to register and recover shares in the Juicebox network.
 * It handles token management, caching, and error handling internally.
 */
export class JuiceboxClient {
  // Private properties

  private juiceboxTokenCache: Map<string, string>; // realmId (hex) -> JWT token

  private client: Client; // Client from juicebox-sdk

  /**
   * Constructor
   * @param backgroundApi - Background API instance to access OneKeyID tokens
   */
  constructor() {
    this.juiceboxTokenCache = new Map<string, string>();

    // Set global callback for juicebox-sdk
    // @ts-ignore
    globalThis.JuiceboxGetAuthToken = (realmId: Uint8Array) =>
      this.getAuthTokenForRealm(realmId);

    // Create internal Client instance from juicebox-sdk
    this.client = new Client(new Configuration(JUICEBOX_CONFIG), []);
  }

  /**
   * Exchange Supabase token for Juicebox tokens for all realms
   * This method must be called before register() or recover()
   *
   * @param supabaseAccessToken - Supabase access token for authentication
   * @returns Promise<void> - Resolves when all tokens are cached
   * @throws {OneKeyLocalError} - If token exchange fails
   */
  async exchangeToken(supabaseAccessToken: string): Promise<void> {
    if (!supabaseAccessToken) {
      throw new OneKeyLocalError('Supabase access token is required');
    }

    const tokenUrl = `${JUICEBOX_AUTH_SERVER}/juicebox/v1/token/realms`;

    const response = await axios.post<
      IApiClientResponse<{
        tokens: Record<string, string>;
      }>
    >(tokenUrl, {
      token: supabaseAccessToken,
    });
    const resData = response?.data;
    if (resData?.code === 0 && resData?.data?.tokens) {
      const realmTokens = resData?.data?.tokens;
      // Validate response format
      if (!realmTokens || typeof realmTokens !== 'object') {
        throw new OneKeyLocalError(
          'Invalid response format: expected object with realm tokens',
        );
      }

      // Cache all realm tokens
      for (const [realmId, token] of Object.entries(realmTokens)) {
        if (!token) {
          throw new OneKeyLocalError(
            `Invalid response format: missing token for realm ${realmId}`,
          );
        }
        this.juiceboxTokenCache.set(realmId, token);
      }

      // Verify all configured realms have tokens
      for (const realm of JUICEBOX_CONFIG.realms) {
        if (!this.juiceboxTokenCache.has(realm.id)) {
          throw new OneKeyLocalError(
            `Missing token for configured realm: ${realm.id}`,
          );
        }
      }
    } else {
      throw new OneKeyLocalError(
        `Get Juicebox Token Error: ${resData?.code} ${resData?.message}`,
      );
    }
  }

  /**
   * Register a share with PIN and userInfo in the Juicebox network
   *
   * @param pin - User PIN (string)
   * @param secret - Share data to store (utf8 string, will be decoded to Uint8Array)
   * @param userInfo - User identifier, typically ownerId (string)
   * @returns Promise<void> - Resolves when registration is successful
   * @throws {OneKeyLocalError} - If registration fails or juiceboxTokenCache is empty
   * @throws {RegisterError} - SDK-specific registration errors
   */
  async register(params: {
    // TODO In the future, prefix with server user salt before using to enhance security.
    pin: string;
    secret: string; // utf8 string
    userInfo: string; // ownerId
  }): Promise<void> {
    const { pin, secret, userInfo } = params;

    // Validate token cache is not empty
    if (this.juiceboxTokenCache.size === 0) {
      throw new OneKeyLocalError(
        'Juicebox token cache is empty, please call exchangeToken first',
      );
    }

    // Convert strings to Uint8Array
    const pinBytes = bufferUtils.utf8ToBytes(pin);
    const secretBytes = bufferUtils.utf8ToBytes(secret);
    // TODO add juicebox token subject (sub) as prefix to userInfo, like: sub:${userInfo}
    const userInfoBytes = bufferUtils.utf8ToBytes(userInfo);

    // Call SDK register method
    await this.client.register(
      pinBytes,
      secretBytes, // secret exceeds the maximum of 128 bytes
      userInfoBytes,
      JUICEBOX_ALLOWED_GUESSES,
    );

    // Clear token cache after successful registration
    this.clearTokenCache();
  }

  /**
   * Recover a share from the Juicebox network using PIN and userInfo
   *
   * @param pin - User PIN (string)
   * @param userInfo - User identifier, typically ownerId (string)
   * @returns Promise<string> - Recovered share data as utf8 string
   * @throws {OneKeyLocalError} - If recovery fails or juiceboxTokenCache is empty
   * @throws {RecoverError} - SDK-specific recovery errors
   */
  async recover(params: {
    pin: string;
    userInfo: string; // ownerId
  }): Promise<string> {
    try {
      const { pin, userInfo } = params;

      // Validate token cache is not empty
      if (this.juiceboxTokenCache.size === 0) {
        throw new OneKeyLocalError(
          'Juicebox token cache is empty, please call exchangeToken first',
        );
      }

      // Convert strings to Uint8Array
      const pinBytes = bufferUtils.utf8ToBytes(pin);
      const userInfoBytes = bufferUtils.utf8ToBytes(userInfo);

      // Call SDK recover method
      const recoveredSecret: Uint8Array = await this.client.recover(
        pinBytes,
        userInfoBytes,
      );

      if (!recoveredSecret?.length) {
        throw new OneKeyLocalError('Recovery failed: Empty secret.');
      }

      // Convert recovered Uint8Array back to utf8 string
      const secretUtf8 = bufferUtils.bytesToUtf8(recoveredSecret);

      // Clear token cache after successful recovery
      this.clearTokenCache();

      return secretUtf8;
    } catch (e) {
      const error = e as
        | { guesses_remaining: number; reason: number }
        | undefined;
      if (!isNil(error?.guesses_remaining)) {
        throw new OneKeyLocalError(
          `Incorrect PIN, you have ${error?.guesses_remaining} guesses remaining`,
        );
      }
      throw e;
    }
  }

  /**
   * Get authentication token for a specific realm
   * This method is called by the global JuiceboxGetAuthToken callback
   *
   * @param realmId - Realm ID as Uint8Array (from juicebox-sdk)
   * @returns Promise<string> - JWT token for the realm
   * @throws {OneKeyLocalError} - If token not found in cache
   */
  private async getAuthTokenForRealm(realmId: Uint8Array): Promise<string> {
    // Convert realmId to hex string
    const realmIdHex = bufferUtils.bytesToHex(realmId);

    // Get token from cache
    const token = this.juiceboxTokenCache.get(realmIdHex);
    if (!token) {
      throw new OneKeyLocalError(
        'Juicebox token not found, please call exchangeToken first',
      );
    }

    return token;
  }

  /**
   * Clear all cached tokens
   * Useful for logout scenarios or when tokens need to be refreshed
   */
  clearTokenCache(): void {
    this.juiceboxTokenCache.clear();
  }
}
