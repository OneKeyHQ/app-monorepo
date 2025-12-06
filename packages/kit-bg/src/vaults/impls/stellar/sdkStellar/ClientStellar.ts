/* eslint-disable spellcheck/spell-checker */
import { Networks } from '.';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { BASE_FEE } from '../utils';

import { HorizonTransport } from './HorizonTransport';
import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

type IStellarBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

type IStellarAccountInfo = {
  balance: string;
  sequence: string;
  subentry_count: number;
  balances: IStellarBalance[];
};

/**
 * Stellar Client for network interactions
 * Supports three transport modes:
 * 1. HorizonTransport - Direct public Horizon API (default, recommended for Classic Assets)
 * 2. JsonRpcTransport - Soroban RPC (for smart contracts and Soroban-specific features)
 * 3. OneKeyTransport - OneKey proxy server (for special OneKey features)
 */
export default class ClientStellar {
  readonly networkId: string;

  readonly backgroundApi: IBackgroundApi;

  readonly transport: HorizonTransport | JsonRpcTransport | OneKeyTransport;

  readonly customRpcUrl?: string;

  readonly useOneKeyProxy: boolean;

  constructor({
    networkId,
    backgroundApi,
    customRpcUrl,
    useOneKeyProxy = false,
  }: {
    networkId: string;
    backgroundApi: IBackgroundApi;
    customRpcUrl?: string;
    useOneKeyProxy?: boolean; // Force use OneKey proxy
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
    this.customRpcUrl = customRpcUrl;
    this.useOneKeyProxy = useOneKeyProxy;

    /**
     * Transport Selection Logic:
     *
     * Priority 1: If useOneKeyProxy is explicitly set
     *   -> Use OneKeyTransport
     *
     * Priority 2: If customRpcUrl is provided and looks like Soroban RPC
     *   -> Use JsonRpcTransport (for smart contracts)
     *
     * Priority 3: If customRpcUrl is provided and looks like Horizon API
     *   -> Use HorizonTransport with custom endpoint
     *
     * Priority 4: Default (no customRpcUrl)
     *   -> Use HorizonTransport with public endpoint (RECOMMENDED)
     */
    if (useOneKeyProxy) {
      // Mode 1: OneKey Proxy (for special OneKey features)
      this.transport = new OneKeyTransport({ backgroundApi, networkId });
    } else if (customRpcUrl && this.isSorobanRpcUrl(customRpcUrl)) {
      // Mode 2: Soroban RPC (for smart contracts)
      this.transport = new JsonRpcTransport({ rpcUrl: customRpcUrl });
    } else if (customRpcUrl) {
      // Mode 3: Custom Horizon endpoint
      this.transport = new HorizonTransport({ horizonUrl: customRpcUrl });
    } else {
      // Mode 4: Default - Public Horizon API (recommended for Classic Assets)
      this.transport = new HorizonTransport({ networkId });
    }
  }

  /**
   * Detect if URL is a Soroban RPC endpoint
   * Soroban RPC URLs typically contain 'soroban' or '/rpc'
   */
  private isSorobanRpcUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('soroban') || lowerUrl.includes('/rpc');
  }

  /**
   * Check if account exists on the network
   */
  async accountExists(address: string): Promise<boolean> {
    try {
      await this.transport.getAccountInfo(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get account information from the network
   */
  async getAccountInfo(address: string): Promise<IStellarAccountInfo | null> {
    try {
      const data = (await this.transport.getAccountInfo(
        address,
      )) as IStellarAccountInfo | null;
      if (!data) {
        return null;
      }

      const balances = data.balances ?? [];
      const nativeBalance =
        balances.find((b) => b.asset_type === 'native')?.balance ?? '0';

      return {
        balance: nativeBalance,
        sequence: data.sequence ?? '0',
        subentry_count: data.subentry_count ?? 0,
        balances,
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      return null;
    }
  }

  /**
   * Check if account has trustline for asset
   *
   * Uses different methods depending on transport type:
   * - JsonRpcTransport: Uses getLedgerEntries to query specific trustline
   * - OneKeyTransport: Uses Horizon API to get all balances and search
   */
  async hasTrustline(
    address: string,
    assetCode: string,
    assetIssuer: string,
  ): Promise<boolean> {
    // If using JsonRpcTransport, use the dedicated getTrustline method
    if ('getTrustline' in this.transport) {
      const trustline = await this.transport.getTrustline(
        address,
        assetCode,
        assetIssuer,
      );
      return trustline !== null && trustline.authorized;
    }

    // Fallback to checking all balances (for OneKeyTransport/Horizon API)
    const accountInfo = await this.getAccountInfo(address);
    if (!accountInfo) {
      return false;
    }

    return accountInfo.balances.some(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer,
    );
  }

  /**
   * Get specific trustline information
   * Only available when using JsonRpcTransport (direct RPC)
   *
   * @param address - Account address
   * @param assetCode - Asset code (e.g., "USDC")
   * @param assetIssuer - Asset issuer public key
   * @returns Trustline details or null if not found
   */
  async getTrustline(
    address: string,
    assetCode: string,
    assetIssuer: string,
  ): Promise<{
    asset_type: string;
    asset_code: string;
    asset_issuer: string;
    balance: string;
    limit: string;
    authorized: boolean;
  } | null> {
    if ('getTrustline' in this.transport) {
      return this.transport.getTrustline(address, assetCode, assetIssuer);
    }
    throw new OneKeyInternalError(
      'getTrustline is only available with JsonRpcTransport (custom RPC)',
    );
  }

  /**
   * Get multiple trustlines for an account
   * Only available when using JsonRpcTransport (direct RPC)
   *
   * @param address - Account address
   * @param assets - Array of assets to query (max 200)
   * @returns Array of trustline information
   *
   * Note: This can only query KNOWN assets. To get ALL trustlines,
   * use getAccountInfo() which works with both transports.
   */
  async getTrustlines(
    address: string,
    assets: Array<{ assetCode: string; assetIssuer: string }>,
  ): Promise<
    Array<{
      asset_type: string;
      asset_code: string;
      asset_issuer: string;
      balance: string;
      limit: string;
      authorized: boolean;
    }>
  > {
    if ('getTrustlines' in this.transport) {
      return this.transport.getTrustlines(address, assets);
    }
    throw new OneKeyInternalError(
      'getTrustlines is only available with JsonRpcTransport (custom RPC)',
    );
  }

  /**
   * Get account sequence number
   */
  async getSequence(address: string): Promise<string> {
    const accountInfo = await this.getAccountInfo(address);
    if (!accountInfo) {
      throw new OneKeyInternalError(
        `Account ${address} not found on network`,
      );
    }
    return accountInfo.sequence;
  }

  /**
   * Get suggested fee from network
   */
  async getSuggestedFee(): Promise<string> {
    try {
      const result = await this.transport.getFeeStats();
      // Return mode of inclusion fee for standard transactions
      const modeFee = result.inclusionFee?.mode || BASE_FEE;
      return modeFee;
    } catch (error) {
      // Default to base fee if network call fails
      return BASE_FEE; // 100 stroops
    }
  }

  /**
   * Get network passphrase
   */
  async getNetworkPassphrase(): Promise<string> {
    // Use networkId to determine the correct network passphrase
    // Stellar has specific network passphrases for mainnet and testnet
    if (this.networkId.includes('testnet')) {
      return Networks.TESTNET;
    }
    // Default to mainnet for 'stellar--mainnet' or any other stellar network
    return Networks.PUBLIC;
  }

  /**
   * Submit signed transaction to network
   */
  async submitTransaction(signedTxXdr: string): Promise<string> {
    const result = await this.transport.sendTransaction(signedTxXdr);
    return result.hash;
  }

  /**
   * Get latest ledger information
   * Used for RPC status check
   *
   * Returns the latest ledger known to the Stellar RPC node
   */
  async getLatestLedger(): Promise<{
    id: string;
    sequence: number;
    closeTime: string;
    headerXdr: string;
    metadataXdr: string;
  }> {
    return this.transport.getLatestLedger();
  }

  /**
   * Get token balances for an account
   * Returns all non-native assets (trustlines)
   */
  async getTokenBalances(address: string): Promise<
    Array<{
      asset_type: string;
      asset_code: string;
      asset_issuer: string;
      balance: string;
    }>
  > {
    try {
      const accountInfo = await this.getAccountInfo(address);
      if (!accountInfo) {
        return [];
      }

      // Filter out native balance, return only tokens
      return accountInfo.balances
        .filter((b) => b.asset_type !== 'native')
        .map((b) => ({
          asset_type: b.asset_type,
          asset_code: b.asset_code || '',
          asset_issuer: b.asset_issuer || '',
          balance: b.balance,
        }));
    } catch (error) {
      console.error('Failed to get token balances:', error);
      return [];
    }
  }
}
