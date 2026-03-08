import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import type { ISimulateTransactionResponse } from './types';

/**
 * Stellar JSON-RPC 2.0 Transport
 * Connects directly to Stellar RPC endpoint (Soroban RPC or compatible endpoint)
 * Used for local development and custom network endpoints
 *
 * Example usage:
 *   const transport = new JsonRpcTransport({
 *     rpcUrl: 'https://soroban-testnet.stellar.org',
 *     networkId: 'stellar--testnet',
 *   });
 *   const ledger = await transport.getLatestLedger();
 *   const account = await transport.getLedgerEntries([accountKey]);
 *
 * Stellar RPC API Reference:
 *   https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods
 */
export class JsonRpcTransport {
  private client: JsonRPCRequest;

  constructor({ rpcUrl }: { rpcUrl: string; networkId: string }) {
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
  async simulateTransaction(
    transaction: string,
  ): Promise<ISimulateTransactionResponse> {
    return this.call('simulateTransaction', { transaction });
  }
}
