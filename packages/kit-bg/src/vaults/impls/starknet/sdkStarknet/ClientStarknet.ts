import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import { toPaddedFeltHex } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/viewingKey';
import type {
  IStarknetSignedDeployAccount,
  IStarknetSignedInvoke,
} from '@onekeyhq/core/src/chains/starknet/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  decodeCairoString,
  parseRpcErrorCode,
  u256ToDecimalString,
} from '../utils';

import {
  BLOCK_TAG_LATEST,
  BLOCK_TAG_PENDING,
  BLOCK_TAG_PRE_CONFIRMED,
  ERC20_SELECTOR,
  EStarknetRpcErrorCode,
  SIMULATION_FLAG_SKIP_VALIDATE,
  SPEC_VERSION_PRE_CONFIRMED,
  STRK20_POOL_SELECTOR,
} from './consts';
import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

import type {
  IStarknetAddDeployAccountResult,
  IStarknetAddInvokeResult,
  IStarknetBlockId,
  IStarknetBroadcastTx,
  IStarknetFeeEstimate,
  IStarknetReceipt,
  IStarknetTransport,
} from './types';

/**
 * Flat JSON-RPC client for the calls kit-bg needs. Deliberately not starknet.js
 * RpcProvider: that pulls the account/contract/abi stack into the background
 * bundle on every platform, and the split-runtime targets (iOS, Android,
 * extension) load `bg` as its own JS heap.
 *
 * A user-configured RPC goes direct. All default RPC requests use OneKey's
 * backend proxy, with no fallback to a third-party endpoint.
 */
export default class ClientStarknet {
  readonly networkId: string;

  readonly transport: IStarknetTransport;

  private preConfirmedBlockTagCache: Promise<string> | undefined;

  constructor({
    networkId,
    backgroundApi,
    customRpcUrl,
  }: {
    networkId: string;
    backgroundApi?: IBackgroundApi;
    customRpcUrl?: string;
  }) {
    this.networkId = networkId;
    this.transport = ClientStarknet.createTransport({
      networkId,
      backgroundApi,
      customRpcUrl,
    });
  }

  /** '' when requests go through the backend proxy. */
  get rpcUrl(): string {
    return this.transport.rpcUrl;
  }

  private static createTransport({
    networkId,
    backgroundApi,
    customRpcUrl,
  }: {
    networkId: string;
    backgroundApi?: IBackgroundApi;
    customRpcUrl?: string;
  }): IStarknetTransport {
    if (customRpcUrl) {
      return new JsonRpcTransport({ rpcUrl: customRpcUrl, networkId });
    }
    if (!backgroundApi) {
      throw new OneKeyLocalError(
        'Starknet proxy transport requires a backgroundApi',
      );
    }
    return new OneKeyTransport({ backgroundApi, networkId });
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    return this.transport.request<T>(method, params);
  }

  async getSpecVersion(): Promise<string> {
    return this.call<string>('starknet_specVersion', []);
  }

  /**
   * RPC 0.9 renamed the open-block tag from `pending` to `pre_confirmed` and
   * rejects the old name with -32602. Resolve it once per client from the spec
   * version the endpoint actually serves, so a user's older custom RPC keeps
   * working.
   */
  async getPreConfirmedBlockTag(): Promise<string> {
    if (!this.preConfirmedBlockTagCache) {
      this.preConfirmedBlockTagCache = (async () => {
        try {
          const version = await this.getSpecVersion();
          const [major, minor] = version
            .split('.')
            .map((part) => Number.parseInt(part, 10));
          const isPreConfirmed =
            major > SPEC_VERSION_PRE_CONFIRMED.major ||
            (major === SPEC_VERSION_PRE_CONFIRMED.major &&
              minor >= SPEC_VERSION_PRE_CONFIRMED.minor);
          return isPreConfirmed ? BLOCK_TAG_PRE_CONFIRMED : BLOCK_TAG_PENDING;
        } catch {
          // an endpoint that cannot report its spec version is far more likely
          // to be a current one than a pre-0.9 one
          return BLOCK_TAG_PRE_CONFIRMED;
        }
      })();
    }
    return this.preConfirmedBlockTagCache;
  }

  async getChainId(): Promise<string> {
    return this.call<string>('starknet_chainId', []);
  }

  async getBlockNumber(): Promise<number> {
    return this.call<number>('starknet_blockNumber', []);
  }

  /** Next usable nonce, read from the open block so back-to-back sends differ. */
  async getNonce(address: string, blockId?: IStarknetBlockId): Promise<string> {
    const blockTag = blockId ?? (await this.getPreConfirmedBlockTag());
    return this.call<string>('starknet_getNonce', [
      blockTag,
      sdkStarknet.toFelt(address),
    ]);
  }

  /**
   * An account is a contract, so "deployed" means a class hash exists at the
   * address. Only CONTRACT_NOT_FOUND means undeployed; every other error
   * propagates, or a flaky endpoint turns into a duplicate deploy attempt.
   */
  async isAccountDeployed(
    address: string,
    blockId?: IStarknetBlockId,
  ): Promise<boolean> {
    const blockTag = blockId ?? (await this.getPreConfirmedBlockTag());
    try {
      await this.call<string>('starknet_getClassHashAt', [
        blockTag,
        sdkStarknet.toFelt(address),
      ]);
      return true;
    } catch (error) {
      if (parseRpcErrorCode(error) === EStarknetRpcErrorCode.ContractNotFound) {
        return false;
      }
      throw error;
    }
  }

  async callContract(params: {
    contractAddress: string;
    selector: string;
    calldata?: string[];
    blockId?: IStarknetBlockId;
  }): Promise<string[]> {
    return this.call<string[]>('starknet_call', [
      {
        contract_address: sdkStarknet.toFelt(params.contractAddress),
        entry_point_selector: sdkStarknet.toFelt(params.selector),
        calldata: sdkStarknet.toFeltArray(params.calldata ?? []),
      },
      params.blockId ?? BLOCK_TAG_LATEST,
    ]);
  }

  /**
   * STRK20 pool views. Read against `latest`, never the pre-confirmed tag: the
   * fee and pause state decide whether a transaction is worth building at all.
   */
  async getPoolFeeAmount(
    poolAddress: string,
    blockId?: IStarknetBlockId,
  ): Promise<string> {
    const result = await this.callContract({
      contractAddress: poolAddress,
      selector: STRK20_POOL_SELECTOR.getFeeAmount,
      blockId,
    });
    return u256ToDecimalString(result[0] ?? '0x0', result[1] ?? '0x0');
  }

  async getPoolFeeCollector(
    poolAddress: string,
    blockId: IStarknetBlockId,
  ): Promise<string> {
    const selector = sdkStarknet.buildExecuteCalldata([
      {
        contractAddress: poolAddress,
        entrypoint: 'get_fee_collector',
        calldata: [],
      },
    ])[2];
    const result = await this.callContract({
      contractAddress: poolAddress,
      selector,
      blockId,
    });
    if (!result[0]) throw new OneKeyLocalError('Missing pool fee collector');
    return result[0];
  }

  async isPoolPaused(poolAddress: string): Promise<boolean> {
    const result = await this.callContract({
      contractAddress: poolAddress,
      selector: STRK20_POOL_SELECTOR.isPaused,
    });
    return BigInt(result[0] ?? '0x0') !== BigInt(0);
  }

  /**
   * The viewing public key the pool has on record, or undefined when nothing is
   * registered. Zero is never treated as authoritative: the SNIP's recovery rule
   * says a set-but-different key must surface as a mismatch, and a zero read
   * from a wrong pool address must not look like "not registered yet".
   */
  async getPoolRegisteredPublicKey(params: {
    poolAddress: string;
    accountAddress: string;
  }): Promise<string | undefined> {
    const result = await this.callContract({
      contractAddress: params.poolAddress,
      selector: STRK20_POOL_SELECTOR.getPublicKey,
      calldata: [params.accountAddress],
    });
    const value = result[0];
    if (!value || BigInt(value) === BigInt(0)) {
      return undefined;
    }
    // A viewing public key is a curve x-coordinate in [0, P), not an address.
    // validateAndParseAddress rejects the top of that range, so pad it as a plain
    // felt instead; both produce 0x + 64 lowercase hex, so comparisons still hold.
    return toPaddedFeltHex(BigInt(value));
  }

  async getPoolVersion(poolAddress: string): Promise<string> {
    const result = await this.callContract({
      contractAddress: poolAddress,
      selector: STRK20_POOL_SELECTOR.getVersion,
    });
    return decodeCairoString(result);
  }

  /** ERC-20 balanceOf. Returns the raw u256 felts, low first. */
  async getTokenBalance(params: {
    tokenAddress: string;
    accountAddress: string;
  }): Promise<[string, string]> {
    const result = await this.callContract({
      contractAddress: params.tokenAddress,
      selector: ERC20_SELECTOR.balanceOf,
      calldata: [params.accountAddress],
    });
    return [result[0] ?? '0x0', result[1] ?? '0x0'];
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    const result = await this.callContract({
      contractAddress: tokenAddress,
      selector: ERC20_SELECTOR.decimals,
    });
    return Number(BigInt(result[0] ?? '0x0'));
  }

  /** name/symbol/decimals straight from the contract; there is no token API. */
  async getTokenMetadata(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    const [name, symbol, decimals] = await Promise.all([
      this.callContract({
        contractAddress: tokenAddress,
        selector: ERC20_SELECTOR.name,
      }),
      this.callContract({
        contractAddress: tokenAddress,
        selector: ERC20_SELECTOR.symbol,
      }),
      this.getTokenDecimals(tokenAddress),
    ]);
    return {
      name: decodeCairoString(name),
      symbol: decodeCairoString(symbol),
      decimals,
    };
  }

  /**
   * SKIP_VALIDATE is what lets an undeployed account be estimated at all, and
   * it also lets the placeholder signature through. Passing the deploy and the
   * invoke as a two-element array estimates the invoke against the state the
   * deploy leaves behind, which is the only way to price the first send of a
   * fresh account (verified against Sepolia).
   */
  async estimateFee(
    transactions: IStarknetBroadcastTx[],
  ): Promise<IStarknetFeeEstimate[]> {
    // priced against the open block, the same one getNonce reads: estimating
    // against `latest` while holding a pre-confirmed nonce fails with error 41
    // whenever the account has a transaction in flight
    const blockTag = await this.getPreConfirmedBlockTag();
    return this.call<IStarknetFeeEstimate[]>('starknet_estimateFee', [
      transactions,
      [SIMULATION_FLAG_SKIP_VALIDATE],
      blockTag,
    ]);
  }

  /**
   * `proof` is the STRK20 privacy proof. It is not part of INVOKE_TXN_V3 and is
   * not hashed; BROADCASTED_INVOKE_TXN carries it beside the invoke, and it
   * needs RPC spec 0.10.1+.
   */
  async addInvokeTransaction(
    tx: IStarknetSignedInvoke,
    proof?: string,
  ): Promise<IStarknetAddInvokeResult> {
    return this.call<IStarknetAddInvokeResult>(
      'starknet_addInvokeTransaction',
      [proof ? { ...tx, proof } : tx],
    );
  }

  async addDeployAccountTransaction(
    tx: IStarknetSignedDeployAccount,
  ): Promise<IStarknetAddDeployAccountResult> {
    return this.call<IStarknetAddDeployAccountResult>(
      'starknet_addDeployAccountTransaction',
      [tx],
    );
  }

  /** Null when the node has not seen the hash yet, which reads as still pending. */
  async getTransactionReceipt(
    txHash: string,
  ): Promise<IStarknetReceipt | null> {
    try {
      return await this.call<IStarknetReceipt>(
        'starknet_getTransactionReceipt',
        [sdkStarknet.toFelt(txHash)],
      );
    } catch (error) {
      if (parseRpcErrorCode(error) === EStarknetRpcErrorCode.TxnHashNotFound) {
        return null;
      }
      throw error;
    }
  }
}
