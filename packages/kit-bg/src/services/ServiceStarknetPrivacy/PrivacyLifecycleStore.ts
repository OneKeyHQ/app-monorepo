import { normalizeStarknetChainId } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EStrk20AccountPhase,
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  type EStrk20PrivateTxKind,
  EStrk20SequencingStatus,
  EStrk20TxGateStatus,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacySnapshot,
  type IStrk20AccountPrivacyState,
  type IStrk20PrivacyNetworkConfig,
  type IStrk20SequencingState,
  type IStrk20TransferKind,
  type IStrk20TxGateState,
} from '@onekeyhq/shared/types/starknetPrivacy';

import simpleDb from '../../dbs/simple/simpleDb';

import type { IStarknetPrivacyScope, IStarknetVaultResolver } from './types';
import type { IVaultSettingsPrivacyPool } from '../../vaults/types';

type IPrivacyLifecycleStoreDeps = {
  getPrivacyConfig: (p: {
    networkId: string;
  }) => Promise<IStrk20PrivacyNetworkConfig | undefined>;
  getPrivacyPoolSettings: (
    networkId: string,
  ) => Promise<IVaultSettingsPrivacyPool | undefined>;
  resolvePoolAddress: (networkId: string) => Promise<string>;
  isDisabledByServer: (networkId: string) => Promise<boolean>;
  getStarknetVault: IStarknetVaultResolver;
  isKeyLoaded: (p: IStarknetPrivacyScope) => boolean;
  dropCachedViewingKey: (p: IStarknetPrivacyScope) => void;
};

const EMPTY_TX_GATE: IStrk20TxGateState = {
  status: EStrk20TxGateStatus.Idle,
  latestBlock: 0,
  blocksRemaining: 0,
  estimatedSecondsRemaining: 0,
};

// Safety timeout for legacy pending records without provingBlockId or when the
// RPC cannot report the pool's proof validity window.
const PENDING_DROPPED_FALLBACK_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Pure, deterministic state-machine reducer: derives the single mutually-exclusive
 * `phase` and orthogonal `txGate` from reconciled background facts.
 */
export function deriveAccountPrivacySnapshot(params: {
  available: boolean;
  state?: IStrk20AccountPrivacyState;
  sequencing?: IStrk20SequencingState;
  isKeyLoaded: boolean;
  isSubmitting: boolean;
}): IStrk20AccountPrivacySnapshot {
  const { available, state, sequencing, isKeyLoaded, isSubmitting } = params;
  const hasConsented =
    state?.optInStatus === EStrk20OptInStatus.Consented ||
    state?.optInStatus === EStrk20OptInStatus.RegisterPending ||
    state?.optInStatus === EStrk20OptInStatus.Registered;
  const registerTxFailed = state?.registerTxFailed === true;

  if (!available || !state) {
    return {
      phase: EStrk20AccountPhase.Unavailable,
      txGate: EMPTY_TX_GATE,
      state,
      sequencing,
      hasConsented: false,
      registerTxFailed: false,
    };
  }

  let phase: EStrk20AccountPhase;
  if (state.optInStatus === EStrk20OptInStatus.Mismatch) {
    phase = EStrk20AccountPhase.KeyMismatch;
  } else if (state.optInStatus === EStrk20OptInStatus.RegisterPending) {
    phase = EStrk20AccountPhase.Registering;
  } else if (state.optInStatus === EStrk20OptInStatus.Registered) {
    phase = isKeyLoaded
      ? EStrk20AccountPhase.Ready
      : EStrk20AccountPhase.KeyLocked;
  } else if (state.activationTxid) {
    phase = EStrk20AccountPhase.Activating;
  } else if (
    sequencing?.status === EStrk20SequencingStatus.ActivationRequired
  ) {
    phase = EStrk20AccountPhase.ActivationRequired;
  } else {
    phase = EStrk20AccountPhase.NotOptedIn;
  }

  const pendingTransfer =
    state.lastTransfer?.status === 'pending' ? state.lastTransfer : undefined;

  let txGateStatus: EStrk20TxGateStatus;
  if (isSubmitting) {
    txGateStatus = EStrk20TxGateStatus.Submitting;
  } else if (pendingTransfer) {
    txGateStatus = EStrk20TxGateStatus.PendingTx;
  } else if (
    sequencing?.status === EStrk20SequencingStatus.Waiting &&
    sequencing.blocksRemaining > 0
  ) {
    txGateStatus = EStrk20TxGateStatus.Cooldown;
  } else {
    txGateStatus = EStrk20TxGateStatus.Idle;
  }

  const txGate: IStrk20TxGateState = {
    status: txGateStatus,
    latestBlock: sequencing?.latestBlock ?? 0,
    lastTxBlockNumber: sequencing?.lastTxBlockNumber ?? state.lastTxBlockNumber,
    blocksRemaining: sequencing?.blocksRemaining ?? 0,
    estimatedSecondsRemaining: sequencing?.estimatedSecondsRemaining ?? 0,
    provingBlockId: sequencing?.provingBlockId,
    ...(pendingTransfer ? { pendingTx: pendingTransfer } : {}),
  };

  return {
    phase,
    txGate,
    state,
    sequencing,
    hasConsented,
    registerTxFailed,
  };
}

/**
 * Single background owner of both STRK20 state machines:
 * 1. Account Privacy Lifecycle (activation_required -> activating -> not_opted_in -> registering -> key_locked/ready/key_mismatch)
 * 2. Privacy Transaction Gate (idle -> submitting -> pending_tx -> cooldown)
 *
 * All persisted record writes (`SimpleDbEntityStarknetPrivacy`), receipt reconciliation,
 * 10-block sequencing cooldown checks, and per-account submit mutex live here.
 */
export class PrivacyLifecycleStore {
  private readonly deps: IPrivacyLifecycleStoreDeps;

  // Serializes privacy tx submission per (networkId, accountId) to close the
  // TOCTOU window between assertPrivacyTxCanSubmit and note*Submitted.
  private readonly privacyTxSubmitInFlight = new Set<string>();

  constructor(deps: IPrivacyLifecycleStoreDeps) {
    this.deps = deps;
  }

  private buildSubmitLockKey(p: IStrk20AccountKey): string {
    return `${p.networkId}|${p.accountId}`;
  }

  isSubmitting(p: IStrk20AccountKey): boolean {
    return this.privacyTxSubmitInFlight.has(this.buildSubmitLockKey(p));
  }

  async noteAccountActivationSubmitted(
    p: IStrk20AccountKey & { txid: string },
  ): Promise<void> {
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    await simpleDb.starknetPrivacy.patchRecord({
      ...p,
      poolAddress,
      patch: { activationTxid: p.txid },
    });
  }

  async getAccountPrivacyState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20AccountPrivacyState> {
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    const stored = await simpleDb.starknetPrivacy.getRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
    });
    if (stored?.optInStatus === EStrk20OptInStatus.RegisterPending) {
      return this.reconcileRegisterPending({
        ...p,
        poolAddress,
        record: stored,
      });
    }
    if (stored) {
      return this.reconcileTransfer({ ...p, poolAddress, record: stored });
    }
    return this.buildEmptyState({ ...p, poolAddress });
  }

  /** Called by the vault once the node accepted a register tx. */
  async noteRegisterSubmitted(
    p: IStrk20AccountKey & {
      poolAddress: string;
      txid: string;
      provingBlockId?: number;
    },
  ): Promise<void> {
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: p.poolAddress,
      expected: { optInStatus: EStrk20OptInStatus.Consented },
      patch: {
        optInStatus: EStrk20OptInStatus.RegisterPending,
        registerTxid: p.txid,
        registerSubmittedAt: Date.now(),
        ...(p.provingBlockId !== undefined
          ? { registerProvingBlockId: p.provingBlockId }
          : {}),
        registerTxFailed: false,
      },
    });
  }

  /**
   * Determines whether a pending tx with no RPC receipt (neither receipt nor
   * authoritative status) can no longer land because its proof validity window
   * has elapsed or a conservative wall-clock safety threshold was exceeded.
   */
  private async isDroppedPendingTxExpired(p: {
    client: {
      getBlockNumber?: () => Promise<number>;
      getPoolProofValidityBlocks?: (poolAddress: string) => Promise<number>;
    };
    poolAddress: string;
    provingBlockId?: number;
    submittedAt?: number;
  }): Promise<boolean> {
    if (
      typeof p.provingBlockId === 'number' &&
      typeof p.client.getBlockNumber === 'function' &&
      typeof p.client.getPoolProofValidityBlocks === 'function'
    ) {
      try {
        const [latestBlock, validityBlocks] = await Promise.all([
          p.client.getBlockNumber(),
          p.client.getPoolProofValidityBlocks(p.poolAddress),
        ]);
        if (validityBlocks > 0) {
          return latestBlock > p.provingBlockId + validityBlocks;
        }
      } catch {
        // Fall through to the wall-clock safety timeout when block/window lookup fails.
      }
    }
    return (
      typeof p.submittedAt === 'number' &&
      p.submittedAt > 0 &&
      Date.now() - p.submittedAt >= PENDING_DROPPED_FALLBACK_TIMEOUT_MS
    );
  }

  /**
   * Settles registerPending from the register tx's receipt, so the outcome
   * lands even if the app was closed before it confirmed. A missing receipt
   * stays pending until its proof validity window (or safety timeout) elapses
   * and on-chain state confirms no key was registered.
   */
  private async reconcileRegisterPending(
    p: IStarknetPrivacyScope & { record: IStrk20AccountPrivacyState },
  ): Promise<IStrk20AccountPrivacyState> {
    const { record } = p;
    try {
      const vault = await this.deps.getStarknetVault(p);
      const client = await vault.getClient();
      const receipt = record.registerTxid
        ? await client.getTransactionReceipt(record.registerTxid)
        : null;
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);

      let patch: Partial<IStrk20AccountPrivacyState> | undefined;
      if (status === EOnChainHistoryTxStatus.Success) {
        const registeredPublicKey = await client.getPoolRegisteredPublicKey({
          poolAddress: p.poolAddress,
          accountAddress: record.accountAddress,
        });
        if (!registeredPublicKey) return record;
        patch = {
          optInStatus: EStrk20OptInStatus.Registered,
          registeredPublicKey,
          registerTxFailed: false,
          ...(typeof receipt?.block_number === 'number'
            ? { lastTxBlockNumber: receipt.block_number }
            : {}),
        };
      } else if (status === EOnChainHistoryTxStatus.Failed) {
        patch = {
          optInStatus: EStrk20OptInStatus.Consented,
          registerTxFailed: true,
          ...(typeof receipt?.block_number === 'number'
            ? { lastTxBlockNumber: receipt.block_number }
            : {}),
        };
      } else if (
        receipt === null &&
        (await this.isDroppedPendingTxExpired({
          client,
          poolAddress: p.poolAddress,
          provingBlockId: record.registerProvingBlockId,
          submittedAt: record.registerSubmittedAt,
        }))
      ) {
        const registeredPublicKey = await client.getPoolRegisteredPublicKey({
          poolAddress: p.poolAddress,
          accountAddress: record.accountAddress,
        });
        patch = registeredPublicKey
          ? {
              optInStatus: EStrk20OptInStatus.Registered,
              registeredPublicKey,
              registerTxFailed: false,
            }
          : {
              optInStatus: EStrk20OptInStatus.Consented,
              registerTxFailed: true,
            };
      }
      if (!patch) {
        return record;
      }
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        networkId: p.networkId,
        accountId: p.accountId,
        poolAddress: p.poolAddress,
        patch,
        expected: {
          optInStatus: EStrk20OptInStatus.RegisterPending,
          registerTxid: record.registerTxid,
        },
      });
      return updated ?? record;
    } catch {
      return record;
    }
  }

  async notePrivateTransferSubmitted(
    p: IStarknetPrivacyScope & {
      txid: string;
      kind: IStrk20TransferKind;
      provingBlockId?: number;
      fromRecovery?: boolean;
    },
  ): Promise<void> {
    const existing = await simpleDb.starknetPrivacy.getRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: p.poolAddress,
    });
    // Idempotent for duplicate calls on the same txid; for receipt-based
    // recovery, never overwrite a newer pending transaction or an in-flight submit.
    if (existing?.lastTransfer?.txid === p.txid) {
      return;
    }
    if (
      p.fromRecovery &&
      (this.isSubmitting(p) || existing?.lastTransfer?.status === 'pending')
    ) {
      return;
    }
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: p.poolAddress,
      patch: {
        lastTransfer: {
          txid: p.txid,
          kind: p.kind,
          status: 'pending',
          submittedAt: Date.now(),
          ...(p.provingBlockId !== undefined
            ? { provingBlockId: p.provingBlockId }
            : {}),
        },
      },
    });
  }

  async withPrivacyTxSubmitLock<T>(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = this.buildSubmitLockKey(p);
    if (this.privacyTxSubmitInFlight.has(lockKey)) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    this.privacyTxSubmitInFlight.add(lockKey);
    try {
      await this.assertPrivacyTxCanSubmit(p);
      return await fn();
    } finally {
      this.privacyTxSubmitInFlight.delete(lockKey);
    }
  }

  async assertPrivacyTxCanSubmit(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
  ): Promise<void> {
    if (await this.deps.isDisabledByServer(p.networkId)) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const state = await this.getAccountPrivacyState(p);
    if (
      state.optInStatus === EStrk20OptInStatus.RegisterPending ||
      state.lastTransfer?.status === 'pending'
    ) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    const requiredStatus =
      p.kind === 'register'
        ? EStrk20OptInStatus.Consented
        : EStrk20OptInStatus.Registered;
    if (state.optInStatus !== requiredStatus) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
  }

  private async reconcileTransfer(
    p: IStarknetPrivacyScope & { record: IStrk20AccountPrivacyState },
  ): Promise<IStrk20AccountPrivacyState> {
    const transfer = p.record.lastTransfer;
    if (transfer?.status !== 'pending') return p.record;
    try {
      const client = await (await this.deps.getStarknetVault(p)).getClient();
      const receipt = await client.getTransactionReceipt(transfer.txid);
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);
      if (
        status !== EOnChainHistoryTxStatus.Success &&
        status !== EOnChainHistoryTxStatus.Failed
      ) {
        if (
          receipt !== null ||
          !(await this.isDroppedPendingTxExpired({
            client,
            poolAddress: p.poolAddress,
            provingBlockId: transfer.provingBlockId,
            submittedAt: transfer.submittedAt,
          }))
        ) {
          return p.record;
        }
        return (
          (await simpleDb.starknetPrivacy.patchRecord({
            networkId: p.networkId,
            accountId: p.accountId,
            poolAddress: p.poolAddress,
            expected: { lastTransferTxid: transfer.txid },
            patch: {
              lastTransfer: {
                ...transfer,
                status: 'failed',
              },
            },
          })) ?? p.record
        );
      }
      const blockNumber = receipt?.block_number;
      return (
        (await simpleDb.starknetPrivacy.patchRecord({
          networkId: p.networkId,
          accountId: p.accountId,
          poolAddress: p.poolAddress,
          expected: { lastTransferTxid: transfer.txid },
          patch: {
            lastTransfer: {
              ...transfer,
              status:
                status === EOnChainHistoryTxStatus.Success
                  ? 'confirmed'
                  : 'failed',
            },
            ...(typeof blockNumber === 'number'
              ? {
                  lastTxBlockNumber: Math.max(
                    p.record.lastTxBlockNumber ?? 0,
                    blockNumber,
                  ),
                }
              : {}),
          },
        })) ?? p.record
      );
    } catch {
      return p.record;
    }
  }

  private async buildEmptyState(
    p: IStarknetPrivacyScope,
  ): Promise<IStrk20AccountPrivacyState> {
    const vault = await this.deps.getStarknetVault(p);
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);
    const registeredPublicKey = await vault
      .getClient()
      .then((client) =>
        client.getPoolRegisteredPublicKey({
          poolAddress: p.poolAddress,
          accountAddress: account.address,
        }),
      )
      .catch(() => undefined);
    return {
      profileId: 'account-leaf-v1',
      version: 1,
      networkId: p.networkId,
      accountId: p.accountId,
      chainId: normalizeStarknetChainId(network.chainId),
      accountAddress: account.address,
      poolAddress: p.poolAddress,
      keyIndex: 0,
      accountKeyScheme: 'stark-curve',
      accountKeyFingerprint: '',
      accountDerivationPath: account.path,
      registeredPublicKey,
      optInStatus: EStrk20OptInStatus.None,
    };
  }

  async recordConsent(
    p: IStrk20AccountKey & { consentAcceptedAt: number },
  ): Promise<void> {
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    const current = await this.getAccountPrivacyState(p);
    if (
      current.optInStatus === EStrk20OptInStatus.RegisterPending ||
      current.optInStatus === EStrk20OptInStatus.Registered ||
      current.optInStatus === EStrk20OptInStatus.Mismatch
    ) {
      return;
    }
    await simpleDb.starknetPrivacy.recordConsent({
      ...current,
      poolAddress,
      consentAcceptedAt: p.consentAcceptedAt,
    });
  }

  async optOut(p: IStrk20AccountKey): Promise<void> {
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    await simpleDb.starknetPrivacy.setOptInStatus({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      optInStatus: EStrk20OptInStatus.None,
    });
    this.deps.dropCachedViewingKey({ ...p, poolAddress });
  }

  async getSequencingState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20SequencingState> {
    const poolSettings = await this.deps.getPrivacyPoolSettings(p.networkId);
    if (!poolSettings) {
      return {
        status: EStrk20SequencingStatus.Unavailable,
        latestBlock: 0,
        blocksRemaining: 0,
        estimatedSecondsRemaining: 0,
      };
    }
    const cooldown = poolSettings.sequencingCooldownBlocks;
    const [vault, state] = await Promise.all([
      this.deps.getStarknetVault(p),
      this.getAccountPrivacyState(p),
    ]);
    const client = await vault.getClient();
    const latestBlock = await client.getBlockNumber();
    let lastTxBlockNumber = state.lastTxBlockNumber;
    if (state.activationTxid) {
      const receipt = await client.getTransactionReceipt(state.activationTxid);
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);
      if (status === EOnChainHistoryTxStatus.Pending) {
        return {
          status: EStrk20SequencingStatus.Waiting,
          latestBlock,
          lastTxBlockNumber,
          blocksRemaining: cooldown,
          estimatedSecondsRemaining: 0,
        };
      }
      if (
        status === EOnChainHistoryTxStatus.Success &&
        receipt?.block_number !== undefined
      ) {
        lastTxBlockNumber = Math.max(
          lastTxBlockNumber ?? 0,
          receipt.block_number,
        );
      }
      await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: state.poolAddress,
        expected: { activationTxid: state.activationTxid },
        patch: { activationTxid: undefined, lastTxBlockNumber },
      });
    }
    const address = await vault.getAccountAddress();
    if (!(await client.isAccountDeployed(address))) {
      return {
        status: EStrk20SequencingStatus.ActivationRequired,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: 0,
        estimatedSecondsRemaining: 0,
      };
    }
    if (state.lastTransfer?.status === 'pending') {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: cooldown,
        estimatedSecondsRemaining: 0,
      };
    }

    const { STARKNET_BLOCK_TIME_SECONDS } =
      await import('../../vaults/impls/starknet/sdkStarknet/consts');
    const elapsed =
      lastTxBlockNumber === undefined
        ? cooldown
        : latestBlock - lastTxBlockNumber;
    const blocksRemaining = Math.max(0, cooldown - elapsed);
    if (blocksRemaining > 0) {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining,
        estimatedSecondsRemaining:
          blocksRemaining * STARKNET_BLOCK_TIME_SECONDS,
      };
    }
    const provingBlockId = Math.max(0, latestBlock - (cooldown - 1));
    if (
      !(await client.isAccountDeployed(address, {
        block_number: provingBlockId,
      }))
    ) {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: 1,
        estimatedSecondsRemaining: STARKNET_BLOCK_TIME_SECONDS,
      };
    }
    return {
      status: EStrk20SequencingStatus.Ready,
      latestBlock,
      lastTxBlockNumber,
      blocksRemaining: 0,
      estimatedSecondsRemaining: 0,
      provingBlockId,
    };
  }

  async noteAccountTouchedByTx(
    p: IStrk20AccountKey & { blockNumber: number },
  ): Promise<void> {
    const config = await this.deps.getPrivacyConfig({ networkId: p.networkId });
    if (!config?.poolAddress) {
      return;
    }
    const existing = await simpleDb.starknetPrivacy.getRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: config.poolAddress,
    });
    if (!existing) {
      return;
    }
    if (
      existing.lastTxBlockNumber !== undefined &&
      existing.lastTxBlockNumber >= p.blockNumber
    ) {
      return;
    }
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: config.poolAddress,
      patch: { lastTxBlockNumber: p.blockNumber },
    });
  }

  async getAccountPrivacySnapshot(
    p: IStrk20AccountKey & { available: boolean },
  ): Promise<IStrk20AccountPrivacySnapshot> {
    if (!p.available) {
      return deriveAccountPrivacySnapshot({
        available: false,
        isKeyLoaded: false,
        isSubmitting: false,
      });
    }
    const [state, sequencing] = await Promise.all([
      this.getAccountPrivacyState(p),
      this.getSequencingState(p),
    ]);
    return deriveAccountPrivacySnapshot({
      available: true,
      state,
      sequencing,
      isKeyLoaded: this.deps.isKeyLoaded({
        networkId: p.networkId,
        accountId: p.accountId,
        poolAddress: state.poolAddress,
      }),
      isSubmitting: this.isSubmitting(p),
    });
  }
}
