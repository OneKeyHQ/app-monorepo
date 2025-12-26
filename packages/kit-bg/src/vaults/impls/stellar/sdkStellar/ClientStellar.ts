/* eslint-disable spellcheck/spell-checker */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { BASE_FEE, getNetworkPassphrase } from '../utils';

import { HorizonTransport } from './HorizonTransport';
import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

import type { EStellarAssetType } from '../types';
import { ISimulateTransactionResponse } from './types';

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

export default class ClientStellar {
  readonly networkId: string;

  readonly backgroundApi: IBackgroundApi;

  private readonly transport:
    | HorizonTransport
    | JsonRpcTransport
    | OneKeyTransport;

  readonly customRpcUrl?: string;

  constructor({
    networkId,
    backgroundApi,
    customRpcUrl,
  }: {
    networkId: string;
    backgroundApi: IBackgroundApi;
    customRpcUrl?: string;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
    this.customRpcUrl = customRpcUrl;

    if (customRpcUrl) {
      this.transport = new JsonRpcTransport({
        rpcUrl: customRpcUrl,
        networkId,
      });
    } else {
      this.transport = new OneKeyTransport({ backgroundApi, networkId });
    }
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
    return getNetworkPassphrase(this.networkId);
  }

  /**
   * Submit signed transaction to network
   */
  async submitTransaction(signedTxXdr: string): Promise<string> {
    const result = await this.transport.sendTransaction(signedTxXdr);
    return result.hash;
  }

  /**
   * Simulate transaction
   */
  async simulateTransaction(
    transaction: string,
  ): Promise<ISimulateTransactionResponse> {
    return this.transport.simulateTransaction(transaction);
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
  async getStellarAssetBalances(
    address: string,
    assets?: Array<{ assetCode: string; assetIssuer: string }>,
  ): Promise<
    Array<{
      asset_type: string;
      asset_code: string;
      asset_issuer: string;
      balance: string;
    }>
  > {
    try {
      if (assets?.length && 'getTrustlines' in this.transport) {
        const chunkSize = 200;
        const results: Array<{
          asset_type: string;
          asset_code: string;
          asset_issuer: string;
          balance: string;
        }> = [];
        for (let i = 0; i < assets.length; i += chunkSize) {
          const chunk = assets.slice(i, i + chunkSize);
          const trustlines = await this.transport.getTrustlines(address, chunk);
          results.push(
            ...trustlines.map((t) => ({
              asset_type: t.asset_type,
              asset_code: t.asset_code || '',
              asset_issuer: t.asset_issuer || '',
              balance: t.balance,
            })),
          );
        }
        console.log('====>getTokenBalances: results: ', results);
        return results;
      }

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

  /**
   * Get contract token balances for an account
   * Queries Soroban contract tokens via RPC simulation
   *
   * @param address - Account address
   * @param contractIds - Array of contract addresses (C... encoded)
   * @returns Array of contract balances
   */
  async getContractTokenBalances(
    address: string,
    contractIds: string[],
  ): Promise<Array<{ contractId: string; balance: string }>> {
    if (!contractIds.length) {
      return [];
    }

    // Only JsonRpcTransport supports contract balance queries
    if ('getContractBalances' in this.transport) {
      return this.transport.getContractBalances(address, contractIds);
    }

    // Fallback: return zero balances for other transports
    return contractIds.map((contractId) => ({
      contractId,
      balance: '0',
    }));
  }

  /**
   * Get token metadata for SEP-41 tokens
   * @param contractId - Contract address (C... encoded)
   */
  async getContractTokenInfo(contractId: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    admin?: string;
    type: EStellarAssetType;
  }> {
    if ('getContractTokenInfo' in this.transport) {
      return this.transport.getContractTokenInfo(contractId);
    }

    throw new OneKeyInternalError(
      'getContractTokenInfo is only available with JsonRpcTransport (custom RPC)',
    );
  }
}
