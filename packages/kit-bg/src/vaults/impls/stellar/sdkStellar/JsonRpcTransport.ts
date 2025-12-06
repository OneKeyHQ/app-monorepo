/* eslint-disable spellcheck/spell-checker */
import { Asset, Keypair, StellarSdk, StrKey } from '.';

import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

/**
 * Stellar JSON-RPC 2.0 Transport
 * Connects directly to Stellar RPC endpoint (Soroban RPC or compatible endpoint)
 * Used for local development and custom network endpoints
 *
 * Example usage:
 *   const transport = new JsonRpcTransport({ rpcUrl: 'https://soroban-testnet.stellar.org' });
 *   const ledger = await transport.getLatestLedger();
 *   const account = await transport.getLedgerEntries([accountKey]);
 *
 * Stellar RPC API Reference:
 *   https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods
 */
export class JsonRpcTransport {
  private client: JsonRPCRequest;

  constructor({ rpcUrl }: { rpcUrl: string }) {
    this.client = new JsonRPCRequest(rpcUrl);
  }

  private call<T>(method: string, params?: Record<string, unknown>) {
    return this.client.call<T>(method, params);
  }

  /**
   * getHealth - Get node health status
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth
   */
  async getHealth(): Promise<{ status: string }> {
    return this.call('getHealth');
  }

  /**
   * getLatestLedger - Get the most recent known ledger
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLatestLedger
   */
  async getLatestLedger(): Promise<{
    id: string;
    sequence: number;
    closeTime: string;
    headerXdr: string;
    metadataXdr: string;
  }> {
    return this.call('getLatestLedger');
  }

  /**
   * getLedgerEntries - Access live on-chain state
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLedgerEntries
   *
   * @param keys - Array of base64-encoded ledger entry keys (max 200)
   * @param xdrFormat - Response format: 'base64' (default) or 'json'
   */
  async getLedgerEntries(
    keys: string[],
    xdrFormat?: 'base64' | 'json',
  ): Promise<{
    latestLedger: number;
    entries: Array<{
      key: string;
      xdr: string;
      lastModifiedLedgerSeq: number;
      liveUntilLedgerSeq?: number;
    }>;
  }> {
    const params: Record<string, unknown> = { keys };
    if (xdrFormat) {
      params.xdrFormat = xdrFormat;
    }
    return this.call('getLedgerEntries', params);
  }

  /**
   * getFeeStats - Get statistics about inclusion fees for transactions
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getFeeStats
   */
  async getFeeStats(): Promise<{
    sorobanInclusionFee: {
      min: string;
      max: string;
      mode: string;
      p10: string;
      p20: string;
      p30: string;
      p40: string;
      p50: string;
      p60: string;
      p70: string;
      p80: string;
      p90: string;
      p95: string;
      p99: string;
    };
    inclusionFee: {
      min: string;
      max: string;
      mode: string;
      p10: string;
      p20: string;
      p30: string;
      p40: string;
      p50: string;
      p60: string;
      p70: string;
      p80: string;
      p90: string;
      p95: string;
      p99: string;
    };
    latestLedger: number;
  }> {
    return this.call('getFeeStats');
  }

  /**
   * sendTransaction - Submit a transaction to the network
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/sendTransaction
   *
   * @param transaction - Base64-encoded TransactionEnvelope XDR
   */
  async sendTransaction(transaction: string): Promise<{
    hash: string;
    status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';
    latestLedger: number;
    latestLedgerCloseTime: string;
    errorResultXdr?: string;
    diagnosticEventsXdr?: string[];
  }> {
    return this.call('sendTransaction', { transaction });
  }

  /**
   * getTransaction - Get details for a specific transaction
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction
   *
   * @param hash - Transaction hash (hex string)
   */
  async getTransaction(hash: string): Promise<{
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
    return this.call('getTransaction', { hash });
  }

  /**
   * simulateTransaction - Test a contract invocation without execution
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/simulateTransaction
   *
   * @param transaction - Base64-encoded TransactionEnvelope XDR
   */
  async simulateTransaction(transaction: string): Promise<any> {
    return this.call('simulateTransaction', { transaction });
  }

  /**
   * getNetwork - Obtain network configuration
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getNetwork
   */
  async getNetwork(): Promise<{
    friendbotUrl?: string;
    passphrase: string;
    protocolVersion: number;
  }> {
    return this.call('getNetwork');
  }

  /**
   * getVersionInfo - Access version information
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getVersionInfo
   */
  async getVersionInfo(): Promise<{
    version: string;
    commit_hash: string;
    build_timestamp: string;
    captive_core_version: string;
    protocol_version: number;
  }> {
    return this.call('getVersionInfo');
  }

  /**
   * getEvents - Retrieve contract events
   * https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents
   */
  async getEvents(params: {
    startLedger: number;
    filters?: Array<{
      type?: string;
      contractIds?: string[];
      topics?: Array<string[]>;
    }>;
    pagination?: {
      cursor?: string;
      limit?: number;
    };
  }): Promise<{
    events: any[];
    latestLedger: number;
    cursor?: string;
  }> {
    return this.call('getEvents', params);
  }

  /**
   * getTrustline - Get a specific trustline for an account
   * Verifies if an account has a trustline for a specific asset
   *
   * @param address - Account address
   * @param assetCode - Asset code (e.g., "USDC")
   * @param assetIssuer - Asset issuer public key
   * @returns Trustline information or null if not found
   *
   * Reference: https://developers.stellar.org/docs/build/guides/basics/verify-trustlines
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
      const response = await this.getLedgerEntries([ledgerKey]);
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
   * getTrustlines - Get multiple trustlines for an account
   * Batch query for specific assets (max 200 assets)
   *
   * @param address - Account address
   * @param assets - Array of {assetCode, assetIssuer} to query
   * @returns Array of trustline information for found trustlines
   *
   * Note: This method can only query KNOWN assets. To get ALL trustlines for an account,
   * use Horizon API's /accounts/{id} endpoint instead (see OneKeyTransport.getAccountInfo)
   *
   * Reference: https://developers.stellar.org/docs/data/rpc/api-reference/methods/getLedgerEntries
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
        this.buildTrustlineLedgerKey(address, asset.assetCode, asset.assetIssuer),
      );

      // Batch query all trustlines
      const response = await this.getLedgerEntries(ledgerKeys);

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
   * getAccountInfo - Get account information
   * This is a convenience method that uses getLedgerEntries under the hood
   *
   * IMPORTANT: This method only returns native XLM balance.
   * For trustlines (non-native assets), use Horizon API's /accounts/{id} endpoint
   * or call getTrustlines() with specific assets.
   *
   * Uses Stellar SDK to encode the account address as a LedgerKey XDR
   */
  async getAccountInfo(address: string): Promise<{
    balance: string;
    sequence: string;
    subentry_count: number;
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>;
  }> {
    const accountId = Keypair.fromPublicKey(address).xdrAccountId();
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(
      new StellarSdk.xdr.LedgerKeyAccount({ accountId }),
    );
    const response = await this.getLedgerEntries([ledgerKey.toXDR('base64')]);

    if (!response.entries || response.entries.length === 0) {
      throw new OneKeyInternalError(`Account ${address} not found`);
    }

    // Decode the account data from XDR
    const accountData = StellarSdk.xdr.LedgerEntryData.fromXDR(
      response.entries[0].xdr,
      'base64',
    );

    console.log('=====>>>>> accountData >>>>', accountData);

    const account = accountData.account();

    // Extract balance and account info
    const nativeBalance = account.balance().toString();
    const sequence = account.seqNum().toString();
    const subentryCount = account.numSubEntries();

    // Note: Account entry does NOT contain trustlines
    // Trustlines are separate ledger entries that must be queried individually
    const balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }> = [
      {
        asset_type: 'native',
        balance: nativeBalance,
      },
    ];

    return {
      balance: nativeBalance,
      sequence,
      subentry_count: subentryCount,
      balances,
    };
  }

  private buildTrustlineLedgerKey(
    address: string,
    assetCode: string,
    assetIssuer: string,
  ) {
    const asset = new Asset(assetCode, assetIssuer);
    const publicKeyXdr = StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
      StrKey.decodeEd25519PublicKey(address),
    );
    const trustlineKeyXdr = new StellarSdk.xdr.LedgerKeyTrustLine({
      accountId: publicKeyXdr,
      asset: asset.toTrustLineXDRObject(),
    });
    return StellarSdk.xdr.LedgerKey.trustline(trustlineKeyXdr).toXDR('base64');
  }

  private decodeTrustlineEntry(xdr: string) {
    const ledgerData = StellarSdk.xdr.LedgerEntryData.fromXDR(xdr, 'base64');
    const trustline = ledgerData.trustLine();
    const balance = trustline.balance().toString();
    const limit = trustline.limit().toString();
    // eslint-disable-next-line no-bitwise
    const authorized = (trustline.flags() & 1) !== 0;
    return { balance, limit, authorized };
  }
}
