import { Asset, Keypair, StellarSdk } from '.';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import {
  FailedToTransfer,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';

import { EStellarAssetType } from '../types';
import { BASE_FEE, getNetworkPassphrase, getSACAddress } from '../utils';

import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

import type { ISimulateTransactionResponse } from './types';

type IScVal = ReturnType<typeof StellarSdk.xdr.ScVal.fromXDR>;

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

  private readonly transport: JsonRpcTransport | OneKeyTransport;

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
      const accountInfo = await this.getAccountInfo(address);
      if (!accountInfo) {
        return false;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get account information from the network
   */
  async getAccountInfo(address: string): Promise<IStellarAccountInfo | null> {
    try {
      let data: IStellarAccountInfo | null = null;

      // For JsonRpcTransport, use getLedgerEntries directly
      if (this.transport instanceof JsonRpcTransport) {
        const baseAddress = StellarSdk.extractBaseAddress(address);
        const accountId = Keypair.fromPublicKey(baseAddress).xdrAccountId();
        const ledgerKey = StellarSdk.xdr.LedgerKey.account(
          new StellarSdk.xdr.LedgerKeyAccount({ accountId }),
        );
        const response = await this.transport.getLedgerEntries([
          ledgerKey.toXDR('base64'),
        ]);

        if (!response.entries || response.entries.length === 0) {
          return null;
        }

        // Decode the account data from XDR
        const accountData = StellarSdk.xdr.LedgerEntryData.fromXDR(
          response.entries[0].xdr,
          'base64',
        );

        const account = accountData.account();

        // Extract balance and account info
        const nativeBalance = account.balance().toBigInt().toString();
        const sequence = account.seqNum().toString();
        const subentryCount = account.numSubEntries();

        // Note: Account entry does NOT contain trustlines
        // Trustlines are separate ledger entries
        const balances: IStellarBalance[] = [
          {
            asset_type: 'native',
            balance: nativeBalance,
          },
        ];

        data = {
          balance: nativeBalance,
          sequence,
          subentry_count: subentryCount,
          balances,
        };
      } else {
        // For other transports (Horizon, OneKey), use their getAccountInfo method
        data = (await this.transport.getAccountInfo(
          address,
        )) as IStellarAccountInfo | null;
      }

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
    const trustline = await this.getTrustline(address, assetCode, assetIssuer);
    return trustline !== null && trustline.authorized;
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
    try {
      const ledgerKey = this.buildTrustlineLedgerKey(
        address,
        assetCode,
        assetIssuer,
      );
      const response = await this.transport.getLedgerEntries([ledgerKey]);
      const entry = response.entries?.[0];
      if (!entry) {
        return null;
      }
      const trustline = this.decodeTrustlineEntry(entry.xdr);
      const assetType =
        assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
      return {
        asset_type: assetType,
        asset_code: assetCode,
        asset_issuer: assetIssuer,
        ...trustline,
      };
    } catch (error) {
      console.error('Failed to get trustline:', error);
      return null;
    }
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
    if (assets.length === 0) {
      return [];
    }

    if (assets.length > 200) {
      throw new OneKeyInternalError('Maximum 200 assets allowed per query');
    }

    try {
      const ledgerKeys = assets.map((asset) =>
        this.buildTrustlineLedgerKey(
          address,
          asset.assetCode,
          asset.assetIssuer,
        ),
      );

      // Batch query all trustlines
      const response = await this.transport.getLedgerEntries(ledgerKeys);

      if (!response.entries || response.entries.length === 0) {
        return [];
      }

      const trustlines = response.entries.map((entry, index) => {
        const { balance, limit, authorized } = this.decodeTrustlineEntry(
          entry.xdr,
        );
        const assetCode = assets[index].assetCode;
        const assetType =
          assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
        return {
          asset_type: assetType,
          asset_code: assetCode,
          asset_issuer: assets[index].assetIssuer,
          balance,
          limit,
          authorized,
        };
      });

      return trustlines;
    } catch (error) {
      console.error('Failed to get trustlines:', error);
      return [];
    }
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
    } catch (_error) {
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
   * Wait for transaction to be confirmed on the network
   * Uses polling mechanism similar to Sui implementation
   *
   * @param txid - Transaction hash to wait for
   * @param pollInterval - Time between polling attempts (ms), default 2000ms
   * @param maxRetries - Maximum number of retry attempts, default 30 (60 seconds total)
   * @returns Transaction details when confirmed
   * @throws OneKeyInternalError if transaction fails or times out
   */
  async waitForTransaction(
    txid: string,
    pollInterval = 3000,
    maxRetries = 10,
  ): Promise<{
    status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED';
    latestLedger: number;
    latestLedgerCloseTime: string;
    oldestLedger?: number;
    oldestLedgerCloseTime?: string;
    applicationOrder?: number;
    envelopeXdr?: string;
    resultXdr?: string;
    resultMetaXdr?: string;
    ledger?: number;
    createdAt?: string;
  }> {
    let retryCount = 0;

    const poll = async (): Promise<{
      status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED';
      latestLedger: number;
      latestLedgerCloseTime: string;
      oldestLedger?: number;
      oldestLedgerCloseTime?: string;
      applicationOrder?: number;
      envelopeXdr?: string;
      resultXdr?: string;
      resultMetaXdr?: string;
      ledger?: number;
      createdAt?: string;
    }> => {
      retryCount += 1;

      let transaction;
      try {
        transaction = await this.transport.getTransaction(txid);
      } catch (_error) {
        // If transaction query itself fails and we haven't exceeded retries, continue polling
        if (retryCount <= maxRetries) {
          return new Promise((resolve) => {
            setTimeout(() => {
              void resolve(poll());
            }, pollInterval);
          });
        }
        throw new FailedToTransfer();
      }

      // Transaction found and succeeded
      if (transaction.status === 'SUCCESS') {
        return transaction;
      }

      // Transaction explicitly failed
      if (transaction.status === 'FAILED') {
        throw new FailedToTransfer();
      }

      // Transaction not found yet (status === 'NOT_FOUND')
      if (retryCount > maxRetries) {
        throw new OneKeyInternalError(
          `Transaction ${txid} not found after ${maxRetries} attempts (${
            (maxRetries * pollInterval) / 1000
          }s timeout)`,
        );
      }

      // Continue polling
      return new Promise((resolve) => {
        setTimeout(() => {
          void resolve(poll());
        }, pollInterval);
      });
    };

    return poll();
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
    if (!(this.transport instanceof JsonRpcTransport)) {
      throw new OneKeyInternalError(
        'getLatestLedger is only available with JsonRpcTransport (custom RPC)',
      );
    }
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
      if (assets?.length && this.transport instanceof JsonRpcTransport) {
        const chunkSize = 200;
        const results: Array<{
          asset_type: string;
          asset_code: string;
          asset_issuer: string;
          balance: string;
        }> = [];
        for (let i = 0; i < assets.length; i += chunkSize) {
          const chunk = assets.slice(i, i + chunkSize);
          const trustlines = await this.getTrustlines(address, chunk);
          results.push(
            ...trustlines.map((t) => ({
              asset_type: t.asset_type,
              asset_code: t.asset_code || '',
              asset_issuer: t.asset_issuer || '',
              balance: t.balance,
            })),
          );
        }
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

    const results = await Promise.all(
      contractIds.map(async (contractId) => ({
        contractId,
        balance: await this.getContractBalance(contractId, address),
      })),
    );
    return results;
  }

  /**
   * Get balance for a Soroban contract token
   * Simulates calling the contract's balance() function
   *
   * @param contractId - Contract address (C... encoded)
   * @param address - Account address to check balance for
   * @returns Balance as string, or '0' if not found or error
   */
  private async getContractBalance(
    contractId: string,
    address: string,
  ): Promise<string> {
    try {
      const addressObj = new StellarSdk.Address(address);
      const retval = await this.readContractValue(contractId, 'balance', [
        addressObj.toScVal(),
      ]);
      if (!retval) {
        return '0';
      }
      try {
        const balance = StellarSdk.scValToBigInt(retval);
        return balance.toString();
      } catch {
        return '0';
      }
    } catch (error) {
      console.error('Failed to get contract balance:', error);
      return '0';
    }
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
    try {
      const nameVal = await this.getContractName(contractId);
      const symbolVal = await this.getContractSymbol(contractId);
      const decimalsVal = await this.getContractDecimals(contractId);
      const adminVal = await this.getContractAdmin(contractId);
      if (!nameVal || !symbolVal || !decimalsVal) {
        throw new OneKeyInternalError('Failed to get contract token info');
      }

      let type = EStellarAssetType.ContractToken;

      try {
        const adminAddress = getSACAddress(symbolVal, adminVal ?? '');
        if (adminAddress === contractId) {
          type = EStellarAssetType.StellarAssetContract;
        }
      } catch (_error) {
        // ignore error
      }

      return {
        name: nameVal ?? undefined,
        symbol: symbolVal ?? undefined,
        decimals: decimalsVal ?? undefined,
        admin: adminVal ?? undefined,
        type,
      };
    } catch (error) {
      console.error('Failed to get contract token info:', error);
      throw new OneKeyInternalError('Failed to get contract token info');
    }
  }

  private async getContractName(contractId: string): Promise<string | null> {
    try {
      const scVal = await this.readContractValue(contractId, 'name');
      if (!scVal) {
        return null;
      }
      const value = StellarSdk.scValToNative(scVal);
      if (typeof value === 'string') {
        return value;
      }
      if (
        value &&
        typeof (value as { toString?: () => string }).toString === 'function'
      ) {
        const str = String(value);
        return str || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to get contract name:', error);
      return null;
    }
  }

  private async getContractSymbol(contractId: string): Promise<string | null> {
    try {
      const scVal = await this.readContractValue(contractId, 'symbol');
      if (!scVal) {
        return null;
      }
      const value = StellarSdk.scValToNative(scVal);
      if (typeof value === 'string') {
        return value;
      }
      if (
        value &&
        typeof (value as { toString?: () => string }).toString === 'function'
      ) {
        const str = String(value);
        return str || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to get contract symbol:', error);
      return null;
    }
  }

  private async getContractAdmin(contractId: string): Promise<string | null> {
    try {
      const scVal = await this.readContractValue(contractId, 'admin');
      if (!scVal) {
        return null;
      }
      const value = StellarSdk.scValToNative(scVal);
      if (typeof value === 'string') {
        return value;
      }
      if (
        value &&
        typeof (value as { toString?: () => string }).toString === 'function'
      ) {
        const str = String(value);
        return str || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to get contract admin:', error);
      return null;
    }
  }

  private async getContractDecimals(
    contractId: string,
  ): Promise<number | null> {
    try {
      const scVal = await this.readContractValue(contractId, 'decimals');
      if (!scVal) {
        return null;
      }
      const value = StellarSdk.scValToNative(scVal);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value === 'string' && value !== '') {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      }
      return null;
    } catch (error) {
      console.error('Failed to get contract decimals:', error);
      return null;
    }
  }

  private async readContractValue(
    contractId: string,
    fn: string,
    args: IScVal[] = [],
  ): Promise<IScVal | undefined> {
    const account = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0',
    );
    const networkPassphrase = await this.getNetworkPassphrase();

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.invokeContractFunction({
          contract: contractId,
          function: fn,
          args,
        }),
      )
      .setTimeout(30)
      .build();

    const simulateResult = await this.simulateTransaction(transaction.toXDR());
    const opResults = simulateResult?.results ?? [];
    return this.parseSimulateRetvalFromOp(opResults[0]);
  }

  private parseSimulateRetval(
    retvalBase64: string | undefined,
  ): IScVal | undefined {
    if (!retvalBase64) {
      return undefined;
    }
    try {
      return StellarSdk.xdr.ScVal.fromXDR(retvalBase64, 'base64');
    } catch {
      return undefined;
    }
  }

  private parseSimulateRetvalFromOp(opResult: unknown): IScVal | undefined {
    if (!opResult || typeof opResult !== 'object') {
      return undefined;
    }
    const op = opResult as {
      xdr?: string;
    };
    return this.parseSimulateRetval(op.xdr);
  }

  private buildTrustlineLedgerKey(
    address: string,
    assetCode: string,
    assetIssuer: string,
  ): string {
    const baseAddress = StellarSdk.extractBaseAddress(address);
    const asset = new Asset(assetCode, assetIssuer);
    const accountId = Keypair.fromPublicKey(baseAddress).xdrAccountId();
    const trustlineKeyXdr = new StellarSdk.xdr.LedgerKeyTrustLine({
      accountId,
      asset: asset.toTrustLineXDRObject(),
    });
    return StellarSdk.xdr.LedgerKey.trustline(trustlineKeyXdr).toXDR('base64');
  }

  private decodeTrustlineEntry(xdr: string): {
    balance: string;
    limit: string;
    authorized: boolean;
  } {
    const ledgerData = StellarSdk.xdr.LedgerEntryData.fromXDR(xdr, 'base64');
    const trustline = ledgerData.trustLine();
    const balance = trustline.balance().toString();
    const limit = trustline.limit().toString();
    // eslint-disable-next-line no-bitwise
    const authorized = (trustline.flags() & 1) !== 0;
    return { balance, limit, authorized };
  }
}
