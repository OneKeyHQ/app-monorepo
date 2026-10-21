import type {
  IStarknetCall,
  IStarknetResourceBounds,
  IStrk20ProofInvocationPayload,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  EStrk20PrivateTxKind,
  IStrk20HistoryChannelKind,
  IStrk20HistoryCursor,
  IStrk20OhttpConfig,
  IStrk20ProvingKind,
} from '@onekeyhq/shared/types/starknetPrivacy';

import type {
  HistoryCursor,
  HistoryTransaction,
  PrivateTransfersInterface,
  ProofProviderConfig,
  ProofProviderInterface,
} from '../../vaults/impls/starknet/sdkStarknet/privacy';
import type { IKeyringStrk20ProofInvocationSigner } from '../../vaults/types';
import type {
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
 * cannot happen while the remote config is disabled.
 */
async function loadSdk() {
  return import('../../vaults/impls/starknet/sdkStarknet/privacy');
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
        invocation,
      });
      return [r, s];
    },
  } as SignerInterface;

  return signer;
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
  provingApiKey?: string;
  nodeUrl?: string;
  ohttp?: IStrk20SdkOhttpOption;
}): Promise<PrivateTransfersInterface> {
  const {
    createPrivateTransfers,
    IndexerDiscoveryProvider,
    ProvingServiceProofProvider,
    StarkscanProvingService,
  } = await loadSdk();
  // the SDK's chainId is starknet.js's StarknetChainId, which is the same
  // felt-encoded string the RPC reports
  const chainId = params.chainId as never;
  let provingProvider: ProofProviderInterface | ProofProviderConfig;
  if (params.provingKind === 'starkscan') {
    if (!params.provingApiKey) {
      throw new OneKeyLocalError(
        'STRK20 Starkscan proving requires an API key',
      );
    }
    const transport = new StarkscanProvingService({
      baseUrl: params.provingUrl,
      apiKey: params.provingApiKey,
    });
    provingProvider = new ProvingServiceProofProvider('', chainId, {
      transport,
      nodeUrl: params.nodeUrl,
      poolAddress: params.poolAddress,
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

const HISTORY_CHANNEL_KINDS = new Set<IStrk20HistoryChannelKind>([
  'incoming',
  'outgoing',
  'self_channel',
]);

/** bigint does not survive the bg/main boundary, so cursors travel as hex. */
export function serializeHistoryCursor(
  cursor: HistoryCursor,
): IStrk20HistoryCursor {
  return {
    subchannels: cursor.subchannels.map((subchannel) => ({
      channelKey: toHex(subchannel.channelKey),
      token: toHex(subchannel.token),
      channelKind: subchannel.channelKind,
      counterparty: toHex(subchannel.counterparty),
      nextIndex: subchannel.nextIndex,
    })),
    beginBlockNumber: cursor.beginBlockNumber,
    historyComplete: cursor.historyComplete,
  };
}

export function deserializeHistoryCursor(
  cursor: IStrk20HistoryCursor,
): HistoryCursor {
  return {
    subchannels: cursor.subchannels.map((subchannel) => {
      if (!HISTORY_CHANNEL_KINDS.has(subchannel.channelKind)) {
        throw new OneKeyLocalError(
          `Unknown STRK20 history channel kind: ${subchannel.channelKind}`,
        );
      }
      return {
        channelKey: BigInt(subchannel.channelKey),
        token: BigInt(subchannel.token),
        channelKind: subchannel.channelKind,
        counterparty: BigInt(subchannel.counterparty),
        nextIndex: subchannel.nextIndex,
      };
    }),
    beginBlockNumber: cursor.beginBlockNumber,
    historyComplete: cursor.historyComplete,
  };
}

/**
 * Maps the remote config's OHTTP block onto the SDK's option. The gateway is
 * always the discovery or proving base URL the client is already using, so only
 * the relay and the pinned key config travel. The parser rejects an enabled
 * config with no pinned key, so by here `publicKeyConfig` is present whenever
 * the feature is on.
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

export async function fetchStrk20HistoryPage(params: {
  discoveryUrl: string;
  poolAddress: string;
  accountAddress: string;
  viewingKey: string;
  cursor?: IStrk20HistoryCursor;
  ohttp?: IStrk20SdkOhttpOption;
}): Promise<IStrk20HistoryPage> {
  const { IndexerDiscoveryProvider } = await loadSdk();
  const provider = new IndexerDiscoveryProvider(
    params.discoveryUrl,
    params.poolAddress,
    { ohttp: params.ohttp },
  );
  const address = BigInt(params.accountAddress);
  const viewingKey = BigInt(params.viewingKey);

  // fetchHistory needs both cursors, and they only exist after discovery: the
  // history feed is anchored to the notes and channels we can actually see.
  const [notes, channels] = await Promise.all([
    provider.discoverNotes(address, viewingKey),
    provider.discoverChannels(address, viewingKey, 'all'),
  ]);

  let historyCursor = params.cursor
    ? deserializeHistoryCursor(params.cursor)
    : undefined;
  const transactions: HistoryTransaction[] = [];

  for (let page = 0; page < HISTORY_PAGE_BUDGET; page += 1) {
    const result = await provider.fetchHistory(
      address,
      notes.cursor,
      { channels: channels.channels, total: channels.total },
      {
        maxTransactions: HISTORY_MAX_TRANSACTIONS,
        historyCursor,
      },
    );
    transactions.push(...result.transactions);
    historyCursor = result.cursor;
    if (result.cursor.historyComplete) {
      break;
    }
  }

  return {
    transactions,
    cursor: historyCursor ?? {
      subchannels: [],
      historyComplete: true,
    },
  };
}

/**
 * Which of the four kinds a history row represents. Withdrawals are checked
 * first because `user_addr` is encrypted, so a withdrawal that merely shares a
 * transaction with our notes still has to render as a withdrawal rather than
 * being silently relabelled a transfer.
 */
export function resolvePrivateHistoryKind(transaction: {
  deposits: unknown[];
  withdrawals: unknown[];
  openNoteDeposits: unknown[];
  registration?: unknown;
}): EStrk20PrivateTxKind {
  if (transaction.registration !== undefined) {
    return 'register';
  }
  if (transaction.withdrawals.length > 0) {
    return 'withdraw';
  }
  if (
    transaction.deposits.length > 0 ||
    transaction.openNoteDeposits.length > 0
  ) {
    return 'deposit';
  }
  return 'transfer';
}
