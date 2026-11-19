import BigNumber from 'bignumber.js';

import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import {
  completeEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  settleEarnFunding,
} from './earnFundingRegistry';

type IContinuationIdentity = {
  depositKey: string;
  accountId: string;
  networkId: string;
  accountAddress: string;
};

/** Reconcile only the saved transaction on its bound account and network. */
export async function reconcileEarnFundingContinuation({
  depositKey,
  accountId,
  networkId,
  accountAddress,
  expectedTxId,
}: IContinuationIdentity & { expectedTxId?: string }) {
  const current = await refreshEarnFunding(depositKey);
  if (
    !current ||
    current.status === 'preparing' ||
    current.status === 'unknown'
  )
    return 'pending' as const;
  if (expectedTxId && current.txId !== expectedTxId) return 'pending' as const;
  if (current.status === 'funded') {
    return (await completeEarnFunding(depositKey, current.txId))
      ? ('confirmed' as const)
      : ('pending' as const);
  }
  const amount = new BigNumber(current.intentAmount ?? '');
  if (!amount.isFinite() || amount.lte(0)) return 'pending' as const;
  const status = await waitForTxFinalStatus({
    accountId,
    networkId,
    txid: current.txId,
    expectedAccountAddress: accountAddress,
  });
  if (status === EOnChainHistoryTxStatus.Failed) {
    await releaseEarnFunding(depositKey, current.txId);
    return 'failed' as const;
  }
  if (status !== EOnChainHistoryTxStatus.Success) return 'pending' as const;
  await settleEarnFunding(depositKey, current.txId, amount.toFixed());
  return (await completeEarnFunding(depositKey, current.txId))
    ? ('confirmed' as const)
    : ('pending' as const);
}

/** Keeps the source receipt reserved until its destination confirms on-chain. */
export function reserveEarnFundingContinuation({
  depositKey,
  amount,
  fundingKey,
  fundingTxId,
  accountId,
  networkId,
  accountAddress,
}: IContinuationIdentity & {
  amount: string;
  fundingKey: string;
  fundingTxId: string;
}) {
  if (
    !depositKey ||
    !fundingKey ||
    !fundingTxId.trim() ||
    !amount ||
    !accountId ||
    !networkId ||
    !accountAddress
  )
    return undefined;
  const reservation = reserveEarnFunding(depositKey, {
    amount,
    source: { scope: fundingKey, txId: fundingTxId },
  });
  if (!reservation) return undefined;

  let cancelled = false;
  let acceptedTxId: string | undefined;
  let claim: Promise<void> | undefined;
  let release: Promise<void> | undefined;
  const accepted = new Map<string, Promise<void>>();
  const startClaim = () => {
    if (cancelled)
      throw new OneKeyLocalError('Earn funding continuation was cancelled');
    claim ??= reservation.markUnknown();
    return claim;
  };
  const onSafeCancel = () => {
    if (acceptedTxId) return Promise.resolve();
    cancelled = true;
    release ??= (async () => {
      try {
        await claim;
      } catch {
        // A failed claim can still leave a local reservation to release.
      }
      await reservation.release();
    })();
    return release;
  };
  return {
    beforeSend: async () => {
      await startClaim();
      if (cancelled)
        throw new OneKeyLocalError('Earn funding continuation was cancelled');
    },
    onSafeCancel,
    onUncertain: startClaim,
    onNotStarted: () => (claim ? Promise.resolve() : onSafeCancel()),
    onAccepted: (txId: string) => {
      const id = txId.trim();
      if (!id)
        return Promise.reject(
          new OneKeyLocalError('Missing destination transaction ID'),
        );
      const existing = accepted.get(id);
      if (existing) return existing;
      if (cancelled)
        return Promise.reject(
          new OneKeyLocalError('Earn funding continuation was cancelled'),
        );
      acceptedTxId = id;
      const operation = (async () => {
        await startClaim();
        await reservation.markSubmitted(id);
        void reconcileEarnFundingContinuation({
          depositKey,
          accountId,
          networkId,
          accountAddress,
          expectedTxId: id,
        }).catch(() => {
          console.error('Unable to reconcile Earn funding continuation');
        });
      })().catch((error: unknown) => {
        accepted.delete(id);
        throw error;
      });
      accepted.set(id, operation);
      return operation;
    },
  };
}
