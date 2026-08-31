/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isPrimeInfiniPaymentCacheIdentityForKey,
  isPrimeInfiniPaymentExplicitlySuccessfulSnapshot,
  isPrimeInfiniPurchaseCompletedSnapshot,
  isSamePrimeInfiniNetworkAddress,
  isSamePrimeInfiniPaymentTransferSnapshot,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentValidationFailure,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPurchaseStatusSnapshot,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  getPrimeInfiniPaymentOutcome,
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniPaymentClosedUnpaid,
  isPrimeInfiniPaymentForAsset,
  isPrimeInfiniPaymentReplaceable,
} from './primeInfiniPaymentUtils';

import type { IPrimeInfiniPaymentPhase } from './primeInfiniPaymentUtils';

export type IPrimeInfiniPaymentSessionRevision = {
  updatedAt: number;
  sendStarted: boolean;
};

export type IPrimeInfiniPaymentReplacementResult =
  | {
      type: 'replace';
      payment: IPrimeInfiniPayment;
    }
  | {
      type: 'track';
      payment: IPrimeInfiniPayment;
    }
  | {
      type: 'reload';
    }
  | {
      type: 'cancelled';
    };

export type IPrimeInfiniPaymentAccountRebindResult =
  | {
      type: 'rebind';
      session: IPrimeInfiniPendingPaymentSession;
    }
  | {
      type: 'track';
      payment: IPrimeInfiniPayment;
    }
  | {
      type: 'reload';
    }
  | {
      type: 'cancelled';
    };

export type IPrimeInfiniPaymentForcedReplacementResult =
  | {
      type: 'replace';
      payment: IPrimeInfiniPayment;
    }
  | {
      type: 'track';
      payment: IPrimeInfiniPayment;
    }
  | {
      type: 'completed';
    }
  | {
      type: 'reload';
    }
  | {
      type: 'cancelled';
    };

type IPrimeInfiniAccountSelection = {
  indexedAccountId?: string;
  othersWalletAccountId?: string;
  deriveType?: string;
};

export function addPrimeInfiniDiscardedPaymentBindingId(
  current: ReadonlySet<string>,
  bindingId: string,
) {
  if (current.has(bindingId)) {
    return current;
  }
  const next = new Set(current);
  next.add(bindingId);
  return next;
}

function getPrimeInfiniAccountSelectionId(
  selection: IPrimeInfiniAccountSelection,
) {
  if (selection.indexedAccountId) {
    return `indexed:${selection.indexedAccountId}`;
  }
  if (selection.othersWalletAccountId) {
    return `others:${selection.othersWalletAccountId}`;
  }
  return '';
}

export function getPrimeInfiniAccountSelectionIdentity(
  selection: IPrimeInfiniAccountSelection,
) {
  const selectionId = getPrimeInfiniAccountSelectionId(selection);
  if (!selectionId || !selection.indexedAccountId) {
    return selectionId;
  }
  return `${selectionId}:${selection.deriveType ?? ''}`;
}

export function getPrimeInfiniConfirmedAccountSelectionOutcome({
  selectorOpen,
  initialSelectionIdentity,
  selectedAccount,
  confirmation,
}: {
  selectorOpen: boolean;
  initialSelectionIdentity: string;
  selectedAccount: IPrimeInfiniAccountSelection;
  confirmation: IPrimeInfiniAccountSelection & { num: number };
}): 'ignore' | 'same' | 'changed' {
  if (!selectorOpen || confirmation.num !== 0) {
    return 'ignore';
  }
  const confirmedSelectionId = getPrimeInfiniAccountSelectionId(confirmation);
  const selectedAccountId = getPrimeInfiniAccountSelectionId(selectedAccount);
  if (!confirmedSelectionId || confirmedSelectionId !== selectedAccountId) {
    return 'ignore';
  }
  return getPrimeInfiniAccountSelectionIdentity(selectedAccount) ===
    initialSelectionIdentity
    ? 'same'
    : 'changed';
}

export function shouldRebindPrimeInfiniPaymentForAccount({
  accountSyncReady,
  isSelectedNetworkReady,
  activeAccountId,
  activeAccountAddress,
  payerAccountId,
  payerAddress,
  networkId,
  phase,
  payment,
  sendStarted,
}: {
  accountSyncReady: boolean;
  isSelectedNetworkReady: boolean;
  activeAccountId: string | undefined;
  activeAccountAddress: string | undefined;
  payerAccountId: string | undefined;
  payerAddress: string | undefined;
  networkId: string;
  phase: IPrimeInfiniPaymentPhase;
  payment: IPrimeInfiniPayment | undefined;
  sendStarted: boolean;
}) {
  return Boolean(
    accountSyncReady &&
    isSelectedNetworkReady &&
    activeAccountId &&
    payment &&
    phase === 'selecting' &&
    (payerAccountId !== activeAccountId ||
      !activeAccountAddress ||
      !payerAddress ||
      !isSamePrimeInfiniNetworkAddress({
        networkId,
        first: activeAccountAddress,
        second: payerAddress,
      })) &&
    isPrimeInfiniPaymentReplaceable({ payment, sendStarted }),
  );
}

export async function resolvePrimeInfiniPaymentAccountRebind({
  currentPayment,
  selectedAsset,
  sendStarted,
  fetchLatestPayment,
  rebindPaymentSession,
  persistTrackedPayment,
  shouldContinue,
}: {
  currentPayment: IPrimeInfiniPayment;
  selectedAsset: IPrimeInfiniPaymentAsset;
  sendStarted: boolean;
  fetchLatestPayment: (paymentId: string) => Promise<IPrimeInfiniPayment>;
  rebindPaymentSession: (
    payment: IPrimeInfiniPayment,
  ) => Promise<IPrimeInfiniPendingPaymentSession | undefined>;
  persistTrackedPayment: (
    payment: IPrimeInfiniPayment,
  ) => Promise<IPrimeInfiniPendingPaymentSession>;
  shouldContinue: () => boolean;
}): Promise<IPrimeInfiniPaymentAccountRebindResult> {
  const latestPayment = await fetchLatestPayment(currentPayment.paymentId);
  if (
    !isSamePrimeInfiniPaymentTransferSnapshot({
      first: currentPayment,
      second: latestPayment,
      networkId: selectedAsset.networkId,
    }) ||
    !isPrimeInfiniPaymentForAsset({
      payment: latestPayment,
      asset: selectedAsset,
    })
  ) {
    throw new OneKeyLocalError(
      'Infini payment changed before payer account rebinding',
    );
  }
  if (!shouldContinue()) {
    return { type: 'cancelled' };
  }
  const paymentWithDurableProgress = mergePrimeInfiniPaymentProgressSnapshot({
    previous: currentPayment,
    latest: latestPayment,
  });
  if (
    !isPrimeInfiniPaymentReplaceable({
      payment: paymentWithDurableProgress,
      sendStarted: sendStarted || hasPrimeInfiniPaymentProgress(currentPayment),
    })
  ) {
    const persistedSession = await persistTrackedPayment(
      paymentWithDurableProgress,
    );
    return {
      type: 'track',
      payment: persistedSession.payment,
    };
  }

  const reboundSession = await rebindPaymentSession(paymentWithDurableProgress);
  if (!shouldContinue() || !reboundSession) {
    return { type: 'reload' };
  }
  return {
    type: 'rebind',
    session: reboundSession,
  };
}

export async function resolvePrimeInfiniPaymentForcedReplacement({
  currentSession,
  fetchLatestPayment,
  fetchPurchaseStatusSnapshot,
  archivePaymentSession,
  persistTrackedPayment,
  onLatestPaymentUnavailable,
  shouldContinue,
}: {
  currentSession: IPrimeInfiniPendingPaymentSession;
  fetchLatestPayment: (paymentId: string) => Promise<IPrimeInfiniPayment>;
  fetchPurchaseStatusSnapshot: () => Promise<IPrimeInfiniPurchaseStatusSnapshot>;
  archivePaymentSession: (
    payment: IPrimeInfiniPayment,
  ) => Promise<IPrimeInfiniPendingPaymentSession | undefined>;
  persistTrackedPayment: (
    payment: IPrimeInfiniPayment,
  ) => Promise<IPrimeInfiniPendingPaymentSession>;
  onLatestPaymentUnavailable?: (error: unknown) => void;
  shouldContinue: () => boolean;
}): Promise<IPrimeInfiniPaymentForcedReplacementResult> {
  // The invoice endpoint can stay broken for a specific paymentId, which used
  // to abort this whole path and leave the user with no way out at all. Degrade
  // instead: the check that actually matters here is whether the subscription
  // was already granted, and that comes from a different endpoint. Losing the
  // invoice snapshot only costs the secondary "is this invoice itself already
  // confirmed" check, which is unavailable in this state anyway.
  const [latestPayment, purchaseStatusSnapshot] = await Promise.all([
    fetchLatestPayment(currentSession.payment.paymentId).then(
      (payment) => payment,
      (error) => {
        onLatestPaymentUnavailable?.(error);
        return undefined;
      },
    ),
    fetchPurchaseStatusSnapshot(),
  ]);
  if (
    purchaseStatusSnapshot.onekeyUserId !== currentSession.baseline.onekeyUserId
  ) {
    throw new OneKeyLocalError(
      'Infini purchase status user changed before forced replacement',
    );
  }
  if (
    isPrimeInfiniPurchaseCompletedSnapshot({
      baseline: currentSession.baseline,
      purchaseStatusSnapshot,
    })
  ) {
    return { type: 'completed' };
  }
  if (
    latestPayment &&
    (!isSamePrimeInfiniPaymentTransferSnapshot({
      first: currentSession.payment,
      second: latestPayment,
      networkId: currentSession.asset.networkId,
    }) ||
      !isPrimeInfiniPaymentForAsset({
        payment: latestPayment,
        asset: currentSession.asset,
      }))
  ) {
    throw new OneKeyLocalError(
      'Infini payment changed before forced replacement',
    );
  }
  if (!shouldContinue()) {
    return { type: 'cancelled' };
  }
  // Without a fresh invoice this is the last known local state, which is also
  // what the confirmation screen showed the user.
  const paymentWithDurableProgress = latestPayment
    ? mergePrimeInfiniPaymentProgressSnapshot({
        previous: currentSession.payment,
        latest: latestPayment,
      })
    : currentSession.payment;
  if (
    getPrimeInfiniPaymentOutcome({
      payment: paymentWithDurableProgress,
    }) === 'confirmed' ||
    isPrimeInfiniPaymentExplicitlySuccessfulSnapshot(paymentWithDurableProgress)
  ) {
    const persistedSession = await persistTrackedPayment(
      paymentWithDurableProgress,
    );
    return {
      type: 'track',
      payment: persistedSession.payment,
    };
  }

  const archivedSession = await archivePaymentSession(
    paymentWithDurableProgress,
  );
  if (!shouldContinue() || !archivedSession) {
    return { type: 'reload' };
  }
  return {
    type: 'replace',
    payment: archivedSession.payment,
  };
}

export async function resolvePrimeInfiniPaymentReplacement({
  currentPayment,
  selectedAsset,
  sendStarted,
  fetchLatestPayment,
  discardPaymentSession,
  captureSessionRevision,
  discardTerminalPaymentSession,
  fetchPersistedPaymentSession,
  persistTrackedPayment,
  shouldContinue,
  allowTerminalRelease = true,
  allowChangedUnsentQuote = false,
  confirmLatestPayment,
}: {
  currentPayment: IPrimeInfiniPayment;
  selectedAsset: IPrimeInfiniPaymentAsset;
  sendStarted: boolean;
  fetchLatestPayment: (paymentId: string) => Promise<IPrimeInfiniPayment>;
  discardPaymentSession: (paymentId: string) => Promise<boolean>;
  captureSessionRevision: () => Promise<
    IPrimeInfiniPaymentSessionRevision | undefined
  >;
  discardTerminalPaymentSession: (
    latestPayment: IPrimeInfiniPayment,
    sessionRevision: IPrimeInfiniPaymentSessionRevision | undefined,
  ) => Promise<boolean>;
  fetchPersistedPaymentSession: () => Promise<
    IPrimeInfiniPendingPaymentSession | undefined
  >;
  persistTrackedPayment: (
    payment: IPrimeInfiniPayment,
  ) => Promise<IPrimeInfiniPendingPaymentSession>;
  shouldContinue: () => boolean;
  allowTerminalRelease?: boolean;
  allowChangedUnsentQuote?: boolean;
  confirmLatestPayment?: (payment: IPrimeInfiniPayment) => Promise<boolean>;
}): Promise<IPrimeInfiniPaymentReplacementResult> {
  // Pin the stored session before the remote round trip. Reading it after
  // fetchLatestPayment() would adopt a claim made by another window during that
  // request as the expected revision, so the terminal delete below would happily
  // remove a session whose broadcast is already on its way.
  const sessionRevision = await captureSessionRevision();
  const latestPayment = await fetchLatestPayment(currentPayment.paymentId);
  const validationFailure = getPrimeInfiniPaymentValidationFailure({
    payment: latestPayment,
    previousPayment: currentPayment,
    asset: selectedAsset,
    validateQuote: false,
  });
  if (latestPayment.paymentId !== currentPayment.paymentId) {
    throw createPrimeInfiniPaymentValidationError('invalidResponse');
  }
  if (
    validationFailure &&
    (!allowChangedUnsentQuote || validationFailure === 'invalidResponse')
  ) {
    throw createPrimeInfiniPaymentValidationError(validationFailure);
  }
  if (!shouldContinue()) {
    return { type: 'cancelled' };
  }
  const paymentWithDurableProgress = mergePrimeInfiniPaymentProgressSnapshot({
    previous: currentPayment,
    latest: latestPayment,
  });
  if (
    !isPrimeInfiniPaymentReplaceable({
      payment: paymentWithDurableProgress,
      sendStarted:
        sendStarted ||
        sessionRevision?.sendStarted === true ||
        hasPrimeInfiniPaymentProgress(currentPayment),
    })
  ) {
    // A claimed invoice the server closed with nothing collected is dead, but
    // the ordinary discard refuses it because sendStarted stays latched.
    // Release it through the terminal path so changing the selection actually
    // works here instead of sending the user straight back to polling. Only a
    // successful atomic delete may report a replacement.
    if (
      !validationFailure &&
      allowTerminalRelease &&
      isPrimeInfiniPaymentClosedUnpaid(paymentWithDurableProgress)
    ) {
      if (await discardTerminalPaymentSession(latestPayment, sessionRevision)) {
        return {
          type: 'replace',
          payment: paymentWithDurableProgress,
        };
      }
      if (!shouldContinue()) {
        return { type: 'cancelled' };
      }
    }
    const persistedSession = await persistTrackedPayment(
      validationFailure ? currentPayment : paymentWithDurableProgress,
    );
    return {
      type: 'track',
      payment: persistedSession.payment,
    };
  }

  if (
    confirmLatestPayment &&
    (!(await confirmLatestPayment(latestPayment)) || !shouldContinue())
  ) {
    return { type: 'cancelled' };
  }

  const didDiscard = await discardPaymentSession(
    paymentWithDurableProgress.paymentId,
  );
  if (didDiscard) {
    return {
      type: 'replace',
      payment: paymentWithDurableProgress,
    };
  }

  const persistedSession = await fetchPersistedPaymentSession();
  if (!shouldContinue()) {
    return { type: 'cancelled' };
  }
  if (
    persistedSession?.sendStarted &&
    isPrimeInfiniPaymentCacheIdentityForKey(
      {
        paymentId: paymentWithDurableProgress.paymentId,
        networkId: selectedAsset.networkId,
        contractAddress: selectedAsset.contractAddress,
      },
      persistedSession.paymentCacheKey,
    ) &&
    isSamePrimeInfiniPaymentTransferSnapshot({
      first: paymentWithDurableProgress,
      second: persistedSession.payment,
      networkId: selectedAsset.networkId,
    })
  ) {
    return {
      type: 'track',
      payment: persistedSession.payment,
    };
  }
  return { type: 'reload' };
}
