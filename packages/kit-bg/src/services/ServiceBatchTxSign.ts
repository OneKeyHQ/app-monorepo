import { finalizeSignedPsbtHex } from '@onekeyhq/core/src/chains/btc/sdkBtc/batchPsbt';
import { toPsbtNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import type {
  ISignedTxPro,
  ITxInputToSign,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import {
  EBatchTxSignItemStatus,
  EBatchTxSignStatus,
} from '@onekeyhq/shared/types/batchTxSign';
import type {
  IBatchTxSignItemSummary,
  IBatchTxSignProgress,
} from '@onekeyhq/shared/types/batchTxSign';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { batchTxSignAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

import type { ISignTransactionPrefetchedCredentials } from '../vaults/types';
import type { networks } from 'bitcoinjs-lib';

export type IBatchTxSignCreateItem = {
  unsignedTx: IUnsignedTxPro;
  summary: IBatchTxSignItemSummary;
  inputsToSign: Array<Pick<ITxInputToSign, 'index'>>;
  autoFinalized: boolean | undefined;
};

type IBatchTxSignItemState = {
  unsignedTx: IUnsignedTxPro;
  inputsToSign: Array<Pick<ITxInputToSign, 'index'>>;
  autoFinalized: boolean | undefined;
  // Drill-down (markItemSigned) or signRemaining result. Cleared on cancel.
  signedPsbtHex?: string;
  // Mutated in place; also the source of the published progress.items entry.
  summary: IBatchTxSignItemSummary;
};

type IBatchTxSignState = {
  batchId: string;
  accountId: string;
  networkId: string;
  status: EBatchTxSignStatus;
  // Only meaningful while status is Signing; cleared on Stopped/Cancelled/Complete.
  currentIndex?: number;
  isSigning: boolean;
  abortRequested: boolean;
  items: IBatchTxSignItemState[];
};

@backgroundClass()
export default class ServiceBatchTxSign extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Background owns authoritative batch state (items, results, abort) so the
  // UI (extension popup can die at any moment) never holds it. Keyed by batchId.
  private batches = new Map<string, IBatchTxSignState>();

  private requireBatch(batchId: string): IBatchTxSignState {
    const state = this.batches.get(batchId);
    if (!state) {
      throw new OneKeyLocalError(`batchTxSign: unknown batchId ${batchId}`);
    }
    return state;
  }

  private requireItem(
    state: IBatchTxSignState,
    index: number,
  ): IBatchTxSignItemState {
    const item = state.items[index];
    if (!item) {
      throw new OneKeyLocalError(
        `batchTxSign: unknown item index ${index} in batch ${state.batchId}`,
      );
    }
    return item;
  }

  // Progress is always derived from items — the single source of truth —
  // rather than tracked as a separate counter that could drift.
  private buildProgress(state: IBatchTxSignState): IBatchTxSignProgress {
    const items = state.items.map((item) => item.summary);
    const signedCount = items.filter(
      (item) => item.status === EBatchTxSignItemStatus.Signed,
    ).length;
    return {
      batchId: state.batchId,
      accountId: state.accountId,
      networkId: state.networkId,
      status: state.status,
      totalCount: items.length,
      signedCount,
      currentIndex: state.currentIndex,
      items,
    };
  }

  private async publishProgress(state: IBatchTxSignState): Promise<void> {
    await batchTxSignAtom.set(this.buildProgress(state));
  }

  // Routed through a method call (rather than comparing state.status inline)
  // so TS does not over-narrow state.status to a stale literal type across
  // the awaits in signRemaining's loop — cancelBatch mutates it from a
  // separate call while an item is in-flight at the device.
  private isCancelled(state: IBatchTxSignState): boolean {
    return state.status === EBatchTxSignStatus.Cancelled;
  }

  // Only clear the shared atom if it still holds THIS batch's progress —
  // otherwise a second batch created after this one finished/disposed would
  // have its live progress wiped by this batch's stale cleanup.
  private async clearAtomIfOwnedBy(batchId: string): Promise<void> {
    const current = await batchTxSignAtom.get();
    if (current?.batchId === batchId) {
      await batchTxSignAtom.set(undefined);
    }
  }

  @backgroundMethod()
  async createBatch({
    accountId,
    networkId,
    items,
  }: {
    accountId: string;
    networkId: string;
    items: IBatchTxSignCreateItem[];
  }): Promise<{ batchId: string }> {
    const batchId = generateUUID();
    const state: IBatchTxSignState = {
      batchId,
      accountId,
      networkId,
      status: EBatchTxSignStatus.Overview,
      isSigning: false,
      abortRequested: false,
      currentIndex: undefined,
      // Force summary.index to the array position so it can never diverge
      // from currentIndex (also an array position) or from item lookups.
      items: items.map((item, index) => ({
        unsignedTx: item.unsignedTx,
        inputsToSign: item.inputsToSign,
        autoFinalized: item.autoFinalized,
        summary: { ...item.summary, index },
      })),
    };
    this.batches.set(batchId, state);
    // Deliberately NOT published to the shared atom here: the atom is a
    // single global slot, and ServiceDApp.openModal serializes modals — so
    // this batch can be created while another batch's page is still live,
    // and publishing now would knock that page back to a stale fallback
    // snapshot. The page seeds itself via getBatchProgress on mount; the
    // first publish happens once this batch actually changes state
    // (signRemaining / markItemSigned / cancelBatch).
    return { batchId };
  }

  @backgroundMethod()
  async getBatchProgress({
    batchId,
  }: {
    batchId: string;
  }): Promise<IBatchTxSignProgress> {
    const state = this.requireBatch(batchId);
    return this.buildProgress(state);
  }

  @backgroundMethod()
  async getBatchItemUnsignedTx({
    batchId,
    index,
  }: {
    batchId: string;
    index: number;
  }): Promise<IUnsignedTxPro> {
    const state = this.requireBatch(batchId);
    const item = this.requireItem(state, index);
    return item.unsignedTx;
  }

  // Records a drill-down signature captured by the UI's own TxConfirm
  // onSuccess flow, so signRemaining later skips this item.
  @backgroundMethod()
  async markItemSigned({
    batchId,
    index,
    signedPsbtHex,
  }: {
    batchId: string;
    index: number;
    signedPsbtHex: string;
  }): Promise<void> {
    if (!signedPsbtHex) {
      throw new OneKeyLocalError('invalid markItemSigned call');
    }
    const state = this.requireBatch(batchId);
    // A late drill-down callback (TxConfirm onSuccess arriving after the user
    // already cancelled) must not resurrect a cancelled batch into Complete.
    if (this.isCancelled(state)) {
      return;
    }
    const item = this.requireItem(state, index);
    item.signedPsbtHex = signedPsbtHex;
    item.summary.status = EBatchTxSignItemStatus.Signed;
    item.summary.errorMessage = undefined;
    if (
      state.items.every(
        (i) => i.summary.status === EBatchTxSignItemStatus.Signed,
      )
    ) {
      state.status = EBatchTxSignStatus.Complete;
      state.currentIndex = undefined;
    }
    await this.publishProgress(state);
  }

  // Best-effort signature-history record for one directly-signed item,
  // mirroring what the legacy per-psbt flow gets from
  // batchSignAndSendTransaction -> addItemFromSendProcess. Drill-down items
  // go through the real TxConfirm and are recorded there. Never throws: the
  // signature is already obtained, so a decode/record failure must not fail
  // the batch (addItemFromSendProcess itself also swallows errors).
  private async recordSignatureItem({
    state,
    unsignedTx,
    signedTx,
    sourceInfo,
  }: {
    state: IBatchTxSignState;
    unsignedTx: IUnsignedTxPro;
    signedTx: ISignedTxPro;
    sourceInfo: IDappSourceInfo | undefined;
  }): Promise<void> {
    try {
      const decodedTx = await this.backgroundApi.serviceSend.buildDecodedTx({
        networkId: state.networkId,
        accountId: state.accountId,
        unsignedTx,
        saveToLocalHistory: true,
      });
      await this.backgroundApi.serviceSignature.addItemFromSendProcess(
        { signedTx, decodedTx },
        sourceInfo,
      );
    } catch (error) {
      console.error('batchTxSign: signature record failed', error);
    }
  }

  // Sequential loop over items in index order. Never runs in parallel — the
  // hardware device can only handle one signing dialog at a time.
  @backgroundMethod()
  async signRemaining({
    batchId,
    sourceInfo,
  }: {
    batchId: string;
    sourceInfo?: IDappSourceInfo;
  }): Promise<void> {
    const state = this.requireBatch(batchId);
    if (state.isSigning) {
      throw new OneKeyLocalError('batch signing already in progress');
    }
    state.isSigning = true;
    try {
      // Confirm-time precheck (e.g. BTC frozen/protected inscription UTXOs)
      // over everything this loop is about to sign — signTransaction itself
      // never runs it, and unlike the legacy per-psbt flow there is no
      // TxConfirm page per item to do it (drill-down items go through the
      // real TxConfirm, which runs its own precheck). Runs before any status
      // mutation so a rejection leaves the batch fully re-signable.
      const unsignedTxsToSign = state.items
        .filter((item) => item.summary.status !== EBatchTxSignItemStatus.Signed)
        .map((item) => item.unsignedTx);
      await this.backgroundApi.serviceSend.precheckUnsignedTxs({
        networkId: state.networkId,
        accountId: state.accountId,
        unsignedTxs: unsignedTxsToSign,
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
      });

      // cancelBatch/disposeBatch may have run while the precheck (a network
      // call) or the password prompt below was in-flight. Cancelled is
      // terminal: without these re-checks, the status write below would
      // resurrect the batch into Signing, clear the abort observed during
      // the await, and — for a disposed batch — publish a zombie snapshot
      // and keep signing after the user already rejected the request.
      if (this.isCancelled(state)) {
        return;
      }

      // Software (hd/imported) wallets with protectCreateTransaction enabled
      // would otherwise be password-prompted once per item, while the
      // overview screen promises "Authorize once". Collect the credentials a
      // single time here and thread them through every signTransaction call —
      // unlike a global password security session, the no-re-prompt window is
      // bounded by this loop and can never leak to a transaction outside this
      // batch. A prompt rejection escapes before any status mutation, leaving
      // the batch fully re-signable. Hardware wallets confirm each item on
      // the device itself and keep their per-item flow untouched.
      let prefetchedCredentials:
        | ISignTransactionPrefetchedCredentials
        | undefined;
      if (!accountUtils.isHwAccount({ accountId: state.accountId })) {
        const { password, deviceParams } =
          await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount(
            {
              accountId: state.accountId,
              reason: EReasonForNeedPassword.CreateTransaction,
            },
          );
        prefetchedCredentials = { password, deviceParams };
        if (this.isCancelled(state)) {
          return;
        }
      }

      // A previous round may have stopped on a failure; retry those items.
      state.items.forEach((item) => {
        if (item.summary.status === EBatchTxSignItemStatus.Failed) {
          item.summary.status = EBatchTxSignItemStatus.Ready;
          item.summary.errorMessage = undefined;
        }
      });
      state.status = EBatchTxSignStatus.Signing;
      state.abortRequested = false;
      await this.publishProgress(state);

      for (let index = 0; index < state.items.length; index += 1) {
        const item = state.items[index];
        // Skip items already signed (drill-down or a prior successful round).
        if (item.summary.status !== EBatchTxSignItemStatus.Signed) {
          if (state.abortRequested) {
            return;
          }

          state.currentIndex = index;
          item.summary.status = EBatchTxSignItemStatus.Signing;
          // eslint-disable-next-line no-await-in-loop
          await this.publishProgress(state);

          let signedTx: ISignedTxPro;
          try {
            // eslint-disable-next-line no-await-in-loop
            signedTx = await this.backgroundApi.serviceSend.signTransaction({
              accountId: state.accountId,
              networkId: state.networkId,
              unsignedTx: item.unsignedTx,
              signOnly: true,
              prefetchedCredentials,
            });
            // psbtHex is optional on ISignedTxPro. A missing hex here would
            // otherwise mark the item Signed with nothing to finalize, so
            // takeFinalizedResults could never succeed and the user dead-ends
            // after already approving on the device. Route it through the
            // same failure handling as a thrown signing error.
            if (!signedTx.psbtHex) {
              throw new OneKeyLocalError('signed tx missing psbtHex');
            }
          } catch (error) {
            // cancelBatch/disposeBatch may have run while this call was
            // in-flight and it then rejected (device rejection / transport
            // drop after the popup died) — the common failure shape. Keep
            // Cancelled and publish nothing rather than overwriting it with
            // Stopped and writing a zombie snapshot for a deleted batch.
            if (this.isCancelled(state)) {
              throw error;
            }
            item.summary.status = EBatchTxSignItemStatus.Failed;
            item.summary.errorMessage =
              error instanceof Error ? error.message : String(error);
            state.status = EBatchTxSignStatus.Stopped;
            // currentIndex is only meaningful while actively signing.
            state.currentIndex = undefined;
            // eslint-disable-next-line no-await-in-loop
            await this.publishProgress(state);
            throw error;
          }

          // cancelBatch may have run while this item was in-flight at the
          // device; drop the signature we just got instead of recording it.
          if (this.isCancelled(state)) {
            return;
          }

          item.signedPsbtHex = signedTx.psbtHex;
          item.summary.status = EBatchTxSignItemStatus.Signed;
          // eslint-disable-next-line no-await-in-loop
          await this.publishProgress(state);
          // eslint-disable-next-line no-await-in-loop
          await this.recordSignatureItem({
            state,
            unsignedTx: item.unsignedTx,
            signedTx,
            sourceInfo,
          });
        }
      }

      if (!this.isCancelled(state)) {
        state.status = EBatchTxSignStatus.Complete;
        state.currentIndex = undefined;
        await this.publishProgress(state);
      }
    } finally {
      state.isSigning = false;
    }
  }

  @backgroundMethod()
  async cancelBatch({ batchId }: { batchId: string }): Promise<void> {
    const state = this.batches.get(batchId);
    if (!state) {
      return;
    }
    state.abortRequested = true;
    state.status = EBatchTxSignStatus.Cancelled;
    state.currentIndex = undefined;
    // Product rule: cancellation discards any signature already produced but
    // not yet handed back to the caller via takeFinalizedResults. Reset the
    // affected items back to Ready so "Signed" always implies a stored hex —
    // the published Cancelled snapshot must show signedCount 0.
    state.items.forEach((item) => {
      if (item.signedPsbtHex) {
        item.signedPsbtHex = undefined;
        item.summary.status = EBatchTxSignItemStatus.Ready;
        item.summary.errorMessage = undefined;
      }
    });
    await this.publishProgress(state);
  }

  @backgroundMethod()
  async takeFinalizedResults({
    batchId,
  }: {
    batchId: string;
  }): Promise<string[]> {
    const state = this.requireBatch(batchId);
    const hasUnsigned = state.items.some((item) => !item.signedPsbtHex);
    if (hasUnsigned) {
      throw new OneKeyLocalError(
        `batchTxSign: not all items are signed for batch ${batchId}`,
      );
    }

    // Fetch the psbt network lazily — and only once — so batches made up
    // entirely of autoFinalized:false items never need it.
    let psbtNetwork: networks.Network | undefined;
    const results: string[] = [];
    for (const item of state.items) {
      const signedPsbtHex = item.signedPsbtHex as string;
      if (item.autoFinalized === false) {
        results.push(signedPsbtHex);
      } else {
        if (!psbtNetwork) {
          // eslint-disable-next-line no-await-in-loop
          const network = await this.backgroundApi.serviceNetwork.getNetwork({
            networkId: state.networkId,
          });
          psbtNetwork = toPsbtNetwork(network);
        }
        results.push(
          finalizeSignedPsbtHex({
            signedPsbtHex,
            psbtNetwork,
            inputsToSign: item.inputsToSign,
            autoFinalized: item.autoFinalized,
          }),
        );
      }
    }

    // Deliberately KEEP the batch (and any published atom snapshot) alive:
    // these results still have to survive the hand-back to the dapp. The UI
    // resolves the dapp request only after this returns, and if that resolve
    // RPC fails the page stays open and retries Done — which re-enters this
    // method and must find the batch intact. Finalization above is a pure
    // function of the stored hexes, so a repeated call returns identical
    // results. Deletion is owned by the provider's finally block
    // (disposeBatch) once openBatchTxConfirmModal settles either way.
    return results;
  }

  // No-throw cleanup, called from the provider's finally block once the
  // modal promise settles — the single owner of batch deletion
  // (takeFinalizedResults deliberately leaves the batch alive so a failed
  // hand-back can retry).
  @backgroundMethod()
  async disposeBatch({ batchId }: { batchId: string }): Promise<void> {
    const state = this.batches.get(batchId);
    if (state) {
      state.abortRequested = true;
      // Set Cancelled BEFORE removing from the map: an item still in-flight
      // at the hardware (e.g. the extension popup died and the provider's
      // finally called dispose) reads this status on completion and takes
      // the existing drop branch, instead of writing a zombie progress
      // update into the atom for a batch that no longer exists.
      state.status = EBatchTxSignStatus.Cancelled;
    }
    this.batches.delete(batchId);
    await this.clearAtomIfOwnedBy(batchId);
  }
}
