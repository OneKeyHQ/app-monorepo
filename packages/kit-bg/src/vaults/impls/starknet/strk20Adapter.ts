import { tryNormalizeStarknetChainId } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import type {
  IStarknetCall,
  IStarknetResourceBounds,
  IStrk20ProofInvocationPayload,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type { IProxyRequest } from '@onekeyhq/shared/types/proxy';
import type {
  IStrk20OhttpConfig,
  IStrk20ProvingKind,
} from '@onekeyhq/shared/types/starknetPrivacy';

import type { IKeyringStrk20ProofInvocationSigner } from './privacyKeyringTypes';
import type {
  HistoryCursor,
  HistoryTransaction,
  PrivateTransfersInterface,
  ProofProviderConfig,
  ProofProviderInterface,
} from './sdkStarknet/privacy';
import type {
  BlockIdentifier,
  Call,
  DeclareSignerDetails,
  DeployAccountSignerDetails,
  InvocationsSignerDetails,
  Signature,
  SignerInterface,
} from 'starknet';

/**
 * Mirrors the SDK's `OhttpOption`. Declared here rather than imported so the
 * pinned-key mapping (hex in config, bytes in the SDK) is explicit.
 */
export type IStrk20SdkOhttpOption =
  | boolean
  | { relayUrl?: string; publicKeyConfig?: Uint8Array };

/**
 * The only place kit-bg touches the vendored privacy SDK (`sdkStarknet/privacy`). The import is
 * dynamic so the bg bundle does not pay for the SDK (and its OHTTP/HPKE graph)
 * on every launch: nothing loads until a privacy call is actually made, which
 * cannot happen while the server switches privacy off.
 */
async function loadSdk() {
  return import('./sdkStarknet/privacy');
}

type IStarknetResourceBoundsLike = {
  l1_gas?: { max_amount?: unknown; max_price_per_unit?: unknown };
  l2_gas?: { max_amount?: unknown; max_price_per_unit?: unknown };
  l1_data_gas?: { max_amount?: unknown; max_price_per_unit?: unknown };
};

function toHex(value: unknown): string {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === 'number') {
    return `0x${BigInt(value).toString(16)}`;
  }
  if (typeof value === 'string') {
    return value.startsWith('0x') ? value : `0x${BigInt(value).toString(16)}`;
  }
  return '0x0';
}

function toBoundsItem(
  item: { max_amount?: unknown; max_price_per_unit?: unknown } | undefined,
) {
  return {
    max_amount: toHex(item?.max_amount ?? 0n),
    max_price_per_unit: toHex(item?.max_price_per_unit ?? 0n),
  };
}

/** The SDK hands back bigint-ish felts; core's hash helpers want hex strings. */
export function toStarknetResourceBounds(
  bounds: IStarknetResourceBoundsLike | undefined,
): IStarknetResourceBounds {
  return {
    l1_gas: toBoundsItem(bounds?.l1_gas),
    l2_gas: toBoundsItem(bounds?.l2_gas),
    l1_data_gas: toBoundsItem(bounds?.l1_data_gas),
  };
}

/**
 * `SignerInterface` shim. The SDK calls exactly one method — grep of the
 * vendored source finds a single `user.signer.signTransaction(calls, details)`
 * in `internal/proof-invocation-factory.ts`. The other four are unreachable by
 * construction and throw rather than being omitted, so a future upstream change
 * that starts using one fails loudly instead of signing something unintended.
 */
export function createStrk20Signer(params: {
  keyring: IKeyringStrk20ProofInvocationSigner;
  /**
   * Resolved lazily so a read-only context can supply a thrower instead of a
   * password: discovery never signs, and the read paths must not be able to.
   */
  resolvePassword: () => Promise<string>;
  resolveDeviceParams?: () => Promise<IDeviceSharedCallParams | undefined>;
  chainId: string;
  poolAddress: string;
}): SignerInterface {
  const unreachable = (method: string): never => {
    throw new OneKeyLocalError(
      `STRK20 signer: ${method} is not implemented. The SDK only calls signTransaction (internal/proof-invocation-factory.ts); reaching this means upstream changed.`,
    );
  };

  const signer: SignerInterface = {
    getPubKey: () => unreachable('getPubKey'),
    signMessage: () => unreachable('signMessage'),
    signDeployAccountTransaction: (_tx: DeployAccountSignerDetails) =>
      unreachable('signDeployAccountTransaction'),
    signDeclareTransaction: (_tx: DeclareSignerDetails) =>
      unreachable('signDeclareTransaction'),
    async signTransaction(
      calls: Call[],
      details: InvocationsSignerDetails,
    ): Promise<Signature> {
      const v3Details = details as InvocationsSignerDetails & {
        resourceBounds?: IStarknetResourceBoundsLike;
        tip?: unknown;
        paymasterData?: unknown[];
        accountDeploymentData?: unknown[];
        nonceDataAvailabilityMode?: 'L1';
        feeDataAvailabilityMode?: 'L1';
      };

      const invocation: IStrk20ProofInvocationPayload = {
        // the pool is the sender, not the account: it validates this signature
        // on-chain through SNIP-6 is_valid_signature
        poolAddress: params.poolAddress,
        version: '0x3',
        calls: calls.map(
          (call): IStarknetCall => ({
            contractAddress: call.contractAddress,
            entrypoint: call.entrypoint,
            calldata:
              (call.calldata as unknown[] | undefined)?.map((item) =>
                toHex(item),
              ) ?? [],
          }),
        ),
        chainId: params.chainId,
        nonce: toHex(details.nonce ?? 0n),
        accountDeploymentData: (v3Details.accountDeploymentData ?? []).map(
          (item) => toHex(item),
        ),
        nonceDataAvailabilityMode: v3Details.nonceDataAvailabilityMode ?? 'L1',
        feeDataAvailabilityMode: v3Details.feeDataAvailabilityMode ?? 'L1',
        resourceBounds: toStarknetResourceBounds(v3Details.resourceBounds),
        tip: toHex(v3Details.tip ?? 0n),
        paymasterData: (v3Details.paymasterData ?? []).map((item) =>
          toHex(item),
        ),
      };

      const [r, s] = await params.keyring.signStrk20ProofInvocation({
        password: await params.resolvePassword(),
        ...(params.resolveDeviceParams
          ? { deviceParams: await params.resolveDeviceParams() }
          : {}),
        invocation,
      });
      return [r, s];
    },
  } as SignerInterface;

  return signer;
}

/** Wallet-proxy route the backend maps to the Starkscan prover, adding the API key. */
export const STRK20_PROVER_PROXY_ROUTE = 'prover';

/**
 * One wallet-proxy item on the prover route. Unlike other routes it keeps the
 * upstream status, Retry-After and error body: job polling and the retry
 * policy run on them.
 */
export type IStrk20ProverProxyItem = {
  success: boolean;
  status?: number;
  retryAfter?: string;
  data?: unknown;
  error?: string;
};

/** Response status for a proxy item; one without a usable upstream status is a gateway error. */
function getProverProxyItemStatus(item: IStrk20ProverProxyItem): number {
  const { status } = item;
  if (typeof status === 'number' && status >= 200 && status <= 599) {
    return status;
  }
  return item.success ? 200 : 502;
}

/**
 * A fetch for StarkscanProvingService that tunnels each call through the
 * wallet proxy, so the client never holds the Starkscan key. The service runs
 * with an empty baseUrl, so the url it builds is the upstream path.
 */
export function createStrk20ProverProxyFetch(params: {
  networkId: string;
  post: (
    request: IProxyRequest,
    signal?: AbortSignal,
  ) => Promise<IStrk20ProverProxyItem | undefined>;
}): typeof fetch {
  return async (input, init) => {
    const idempotencyKey = new Headers(init?.headers).get('Idempotency-Key');
    const request: IProxyRequest = {
      networkId: params.networkId,
      body: [
        {
          route: STRK20_PROVER_PROXY_ROUTE,
          params: {
            method: init?.method ?? 'GET',
            url: String(input),
            params: [],
            ...(typeof init?.body === 'string'
              ? { data: JSON.parse(init.body) as unknown }
              : {}),
            ...(idempotencyKey
              ? { headers: { 'Idempotency-Key': idempotencyKey } }
              : {}),
          },
        },
      ],
    };
    let item: IStrk20ProverProxyItem | undefined;
    try {
      item = await params.post(request, init?.signal ?? undefined);
    } catch (error) {
      // fetch rejects with a TypeError when no response arrives; the job poller
      // retries that on the same job instead of failing the proof
      throw new TypeError(error instanceof Error ? error.message : '', {
        cause: error,
      });
    }
    if (!item) {
      throw new TypeError('Empty response from the STRK20 prover proxy');
    }
    const body =
      item.data ?? (item.error ? { message: item.error } : undefined);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status: getProverProxyItemStatus(item),
      headers: item.retryAfter ? { 'Retry-After': item.retryAfter } : undefined,
    });
  };
}

export async function createStrk20Transfers(params: {
  accountAddress: string;
  signer: SignerInterface;
  /** Resolved once per call; the SDK never persists it. */
  viewingKey: string;
  poolAddress: string;
  chainId: string;
  discoveryUrl: string;
  provingUrl: string;
  provingKind?: IStrk20ProvingKind;
  /** Required for `starkscan`: see createStrk20ProverProxyFetch. */
  proverFetch?: typeof fetch;
  /** Reads the pool nonce through the same RPC transport as the wallet. */
  getProofNonce?: () => Promise<bigint>;
  nodeUrl?: string;
  ohttp?: IStrk20SdkOhttpOption;
}): Promise<PrivateTransfersInterface> {
  const {
    createPrivateTransfers,
    IndexerDiscoveryProvider,
    ProvingServiceProofProvider,
    StarkscanProvingService,
  } = await loadSdk();
  // Normalize server chainId aliases (e.g. 'mainnet' -> '0x534e5f4d41494e')
  // to the felt-encoded StarknetChainId expected by the vendored privacy SDK.
  const chainId = (tryNormalizeStarknetChainId(params.chainId) ??
    params.chainId) as never;
  let provingProvider: ProofProviderInterface | ProofProviderConfig;
  if (params.provingKind === 'starkscan') {
    if (!params.proverFetch) {
      throw new OneKeyLocalError(
        'STRK20 Starkscan proving needs the wallet proxy fetch',
      );
    }
    if (!params.getProofNonce) {
      throw new OneKeyLocalError(
        'STRK20 Starkscan proving needs the wallet pool nonce reader',
      );
    }
    const transport = new StarkscanProvingService({
      baseUrl: '',
      fetchImpl: params.proverFetch,
    });
    provingProvider = new ProvingServiceProofProvider('', chainId, {
      transport,
      getNonce: params.getProofNonce,
    });
  } else {
    provingProvider = {
      url: params.provingUrl,
      chainId,
      nodeUrl: params.nodeUrl,
      ohttp: params.ohttp,
    };
  }
  return createPrivateTransfers({
    account: { address: params.accountAddress, signer: params.signer },
    viewingKeyProvider: { getViewingKey: async () => params.viewingKey },
    provingProvider,
    /**
     * Constructed here rather than handed over as a `{ url }` config, because
     * `DiscoveryProviderConfig` has no ohttp field and the factory builds the
     * provider without options — so the config route cannot enable OHTTP on the
     * discovery side at all. Every discovery request carries `viewing_key` in
     * its body, so that route would hand the operator the key in the clear.
     */
    discoveryProvider: new IndexerDiscoveryProvider(
      params.discoveryUrl,
      params.poolAddress,
      { ohttp: params.ohttp },
    ),
    poolContractAddress: params.poolAddress,
  });
}

export type IStrk20HistoryBlockRef = string | number;

/** Bg-only cursor passed back into `fetchStrk20HistoryPage`; never crosses IPC. */
export type IStrk20InternalHistoryCursor = {
  cursor: HistoryCursor;
  blockRef?: IStrk20HistoryBlockRef;
};

/**
 * Maps the config's OHTTP block onto the SDK's option. The gateway is always
 * the discovery or proving base URL the client is already using, so only the
 * relay and the pinned key config travel. The built-in config always pins the
 * key (a test guards it), so `publicKeyConfig` is present here.
 */
export function buildOhttpOption(
  ohttp: IStrk20OhttpConfig | undefined,
): IStrk20SdkOhttpOption | undefined {
  if (!ohttp?.enabled) {
    return undefined;
  }
  return {
    relayUrl: ohttp.relayUrl,
    publicKeyConfig: ohttp.publicKeyConfig
      ? // noble's hexToBytes rejects a 0x prefix, which our config carries
        bufferUtils.hexToBytes(ohttp.publicKeyConfig.replace(/^0x/i, ''))
      : undefined,
  };
}

/** One page of protocol history, already flattened for the service. */
export type IStrk20HistoryPage = {
  transactions: HistoryTransaction[];
  cursor: HistoryCursor;
  blockRef?: IStrk20HistoryBlockRef;
};

/**
 * Bounded pagination. An RC.8 page can legitimately come back with zero rows and
 * `historyComplete: false`, so an empty page is not a stop condition — but an
 * unbounded loop against an operator service is not acceptable either, so this
 * stops after PAGE_BUDGET requests and hands the cursor back to continue with.
 */
const HISTORY_PAGE_BUDGET = 5;
/** `max_transactions: 0` is a 400 upstream, so this is never allowed to be 0. */
const HISTORY_MAX_TRANSACTIONS = 50;

function serializeBlockRef(
  blockRef: BlockIdentifier | undefined,
): string | number | undefined {
  return typeof blockRef === 'bigint'
    ? toHex(blockRef)
    : (blockRef ?? undefined);
}

export async function fetchStrk20HistoryPage(params: {
  discoveryUrl: string;
  poolAddress: string;
  accountAddress: string;
  viewingKey: string;
  cursor?: IStrk20InternalHistoryCursor;
  ohttp?: IStrk20SdkOhttpOption;
}): Promise<IStrk20HistoryPage> {
  const { IndexerDiscoveryProvider, buildHistoryCursor } = await loadSdk();
  const provider = new IndexerDiscoveryProvider(
    params.discoveryUrl,
    params.poolAddress,
    { ohttp: params.ohttp },
  );
  const address = BigInt(params.accountAddress);
  let blockRef = params.cursor?.blockRef;
  let cursor: HistoryCursor;
  if (params.cursor) {
    cursor = params.cursor.cursor;
  } else {
    const viewingKey = BigInt(params.viewingKey);
    const notes = await provider.discoverNotes(address, viewingKey);
    const channels = await provider.discoverChannels(
      address,
      viewingKey,
      'all',
      {
        blockIdentifier: notes.timestamp,
      },
    );
    cursor = buildHistoryCursor(address, notes.cursor, channels);
    blockRef = serializeBlockRef(notes.timestamp);
  }
  const transactions: HistoryTransaction[] = [];
  for (
    let page = 0;
    !cursor.historyComplete && page < HISTORY_PAGE_BUDGET;
    page += 1
  ) {
    const result = await provider.fetchHistoryFromCursor(address, cursor, {
      maxTransactions: HISTORY_MAX_TRANSACTIONS,
      blockIdentifier: blockRef,
    });
    blockRef ??= serializeBlockRef(result.blockRef);
    transactions.push(...result.transactions);
    cursor = result.cursor;
    if (
      result.cursor.historyComplete ||
      transactions.length >= HISTORY_MAX_TRANSACTIONS
    ) {
      break;
    }
  }

  return {
    transactions,
    cursor,
    blockRef,
  };
}

/** Only attribute asset movements whose sender or beneficiary is known. */
export async function getStrk20HistoryTransfers(
  transaction: HistoryTransaction,
  account: bigint,
  pool: bigint,
) {
  const { classifyTransaction } = await loadSdk();
  const { actions } = classifyTransaction(transaction);
  const transfers: {
    kind: 'deposit' | 'withdraw' | 'transfer';
    from: bigint;
    to: bigint;
    token: bigint;
    amount: bigint;
  }[] = [];
  for (const action of actions) {
    if (action.type === 'deposit' && action.fromAddress === account) {
      transfers.push({ ...action, kind: 'deposit', from: account, to: pool });
    } else if (action.type === 'withdrawal' && action.toAddress === account) {
      transfers.push({ ...action, kind: 'withdraw', from: pool, to: account });
    } else if (action.type === 'transferSent') {
      transfers.push({
        ...action,
        kind: 'transfer',
        from: account,
        to: action.toAddress,
      });
    } else if (action.type === 'transferReceived') {
      transfers.push({
        ...action,
        kind: 'transfer',
        from: action.fromAddress,
        to: account,
      });
    }
  }
  return transfers;
}
