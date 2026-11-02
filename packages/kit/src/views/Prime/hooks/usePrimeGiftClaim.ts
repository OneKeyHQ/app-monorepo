import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimeGiftEligibilityPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import { isPrimeGiftVerifyCancellationError } from '@onekeyhq/shared/src/utils/primeGiftVerifyError';
import type {
  IPrimeGiftClaimResult,
  IPrimeGiftDeviceVerification,
  IPrimeGiftEligibility,
  IPrimeGiftPreparedRedemption,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { readPrimeInfiniPaymentEntryGuard } from './primeInfiniExternalCheckoutGuard';
import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';
import { requestPrimeRedemption } from './requestPrimeRedemption';
import { usePrimeGiftMessages } from './usePrimeGiftMessages';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IClaimContext = {
  serialNo: string;
  localUserId?: string;
  localIsLoggedIn?: boolean;
};

type IClaimSnapshot = IClaimContext & {
  onekeyUserId?: string;
  eligibility?: IPrimeGiftEligibility;
  verification?: IPrimeGiftDeviceVerification;
  // In-memory only. Never persist or log the redemption code.
  code?: string;
  isPendingPaymentConfirm?: boolean;
  result?: IPrimeGiftClaimResult;
  error?: string;
};

type IVerificationRecord = {
  status: 'redeemed' | 'noCode' | 'success';
  snapshot: IClaimSnapshot;
};

type IServerIdentity = {
  onekeyUserId: string;
  generation: number;
};

type IConfirmedServerIdentity = IClaimContext & {
  onekeyUserId?: string;
};

function isSameLocalContext(
  snapshot: IClaimSnapshot | undefined,
  context: IClaimContext,
) {
  return (
    snapshot?.serialNo === context.serialNo &&
    snapshot.localUserId === context.localUserId &&
    snapshot.localIsLoggedIn === context.localIsLoggedIn
  );
}

// Local account props can stay unchanged while /prime/v1/user/info returns a
// different server user. In-flight work stays bound to the generation captured
// when that work started.
function isSameServerIdentity(
  identity: IServerIdentity,
  current: {
    isCurrent: boolean;
    generation: number;
    confirmedUserId?: string;
  },
) {
  return (
    current.isCurrent &&
    current.generation === identity.generation &&
    current.confirmedUserId === identity.onekeyUserId
  );
}

function confirmedServerUserId(
  confirmed: IConfirmedServerIdentity | undefined,
  context: IClaimContext,
) {
  if (!confirmed || !isSameLocalContext(confirmed, context)) return undefined;
  return confirmed.onekeyUserId;
}

function isServerIdentityReset(
  confirmedUserId: string | undefined,
  onekeyUserId: string | undefined,
) {
  return (
    !onekeyUserId ||
    (Boolean(confirmedUserId) && confirmedUserId !== onekeyUserId)
  );
}

function readClaimableCode(snapshot: IClaimSnapshot | undefined) {
  const code = snapshot?.code?.trim();
  if (!code || snapshot?.verification?.status === 'redeemed') return undefined;
  return code;
}

function verificationRecord(
  current: IClaimSnapshot | undefined,
  context: IClaimContext,
  prepared: IPrimeGiftPreparedRedemption,
  alreadyClaimedMessage: string,
): IVerificationRecord {
  const isAlreadyRedeemed = prepared.verification.status === 'redeemed';
  const code = prepared.code?.trim();
  const base = {
    ...current,
    ...context,
    verification: prepared.verification,
    code: undefined,
  };
  if (isAlreadyRedeemed) {
    return {
      status: 'redeemed',
      snapshot: { ...base, error: alreadyClaimedMessage },
    };
  }
  if (!code) {
    return { status: 'noCode', snapshot: { ...base, error: undefined } };
  }
  return {
    status: 'success',
    snapshot: { ...base, code, error: undefined },
  };
}

function redemptionSnapshot({
  current,
  context,
  outcome,
  claimUserId,
  serialNo,
  email,
}: {
  current: IClaimSnapshot | undefined;
  context: IClaimContext;
  outcome: Awaited<ReturnType<typeof requestPrimeRedemption>>;
  claimUserId: string;
  serialNo: string;
  email?: string;
}): IClaimSnapshot | undefined {
  if (!outcome.ok) {
    if (outcome.presentation.isExpiredSession) return undefined;
    const isAlreadyRedeemed = outcome.presentation.errorCode === 90_502;
    return {
      ...current,
      ...context,
      code: isAlreadyRedeemed ? undefined : current?.code,
      verification: isAlreadyRedeemed
        ? { hasCode: false, status: 'redeemed' }
        : current?.verification,
      error: outcome.presentation.message,
      isPendingPaymentConfirm: false,
    };
  }
  return {
    ...current,
    ...context,
    result: {
      ...outcome.result,
      serialNo,
      onekeyUserId: claimUserId,
      email,
    },
    error: undefined,
    isPendingPaymentConfirm: false,
  };
}

function snapshotForUser(
  current: IClaimSnapshot | undefined,
  context: IClaimContext,
  onekeyUserId: string | undefined,
  identityReset: boolean,
) {
  if (!identityReset) {
    return { ...current, ...context, onekeyUserId };
  }
  return {
    serialNo: context.serialNo,
    localUserId: context.localUserId,
    localIsLoggedIn: context.localIsLoggedIn,
    onekeyUserId,
    eligibility: current?.eligibility,
  };
}

export function usePrimeGiftClaim({
  device,
  serialNo,
  source,
}: {
  device: Omit<SearchDevice, 'commType'>;
  serialNo: string;
  source: IPrimeGiftAnalyticsSource;
}) {
  const { user, loginOneKeyId } = useOneKeyAuth();
  const [eligibilityBySerialNo] = usePrimeGiftEligibilityPersistAtom();
  const message = usePrimeGiftMessages();
  const localUserId = user?.onekeyUserId;
  const localIsLoggedIn = user?.isLoggedIn;
  const contextRef = useRef({
    serialNo,
    localUserId,
    localIsLoggedIn,
    mounted: true,
  });
  Object.assign(contextRef.current, { serialNo, localUserId, localIsLoggedIn });
  const requestRef = useRef(0);
  const serverIdentityGenerationRef = useRef(0);
  // Survives the refresh that clears onekeyUserId before user info returns.
  const confirmedServerIdentityRef = useRef<
    IConfirmedServerIdentity | undefined
  >(undefined);
  const submittingRef = useRef(false);
  const [snapshot, setSnapshotState] = useState<IClaimSnapshot>();
  const snapshotRef = useRef(snapshot);
  const updateSnapshot = useCallback(
    (
      updater: (
        current: IClaimSnapshot | undefined,
      ) => IClaimSnapshot | undefined,
    ) => {
      const next = updater(snapshotRef.current);
      snapshotRef.current = next;
      setSnapshotState(next);
    },
    [],
  );
  const [isQuerying, setIsQuerying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const context = useMemo(
    () => ({ serialNo, localUserId, localIsLoggedIn }),
    [serialNo, localUserId, localIsLoggedIn],
  );
  const isCurrent = useCallback(
    () =>
      contextRef.current.mounted &&
      contextRef.current.serialNo === serialNo &&
      contextRef.current.localUserId === localUserId &&
      contextRef.current.localIsLoggedIn === localIsLoggedIn,
    [serialNo, localUserId, localIsLoggedIn],
  );
  const matchesServerIdentity = useCallback(
    (identity: IServerIdentity) =>
      isSameServerIdentity(identity, {
        isCurrent: isCurrent(),
        generation: serverIdentityGenerationRef.current,
        confirmedUserId: confirmedServerUserId(
          confirmedServerIdentityRef.current,
          contextRef.current,
        ),
      }),
    [isCurrent],
  );
  useEffect(() => {
    const claimContext = contextRef.current;
    claimContext.mounted = true;
    return () => {
      claimContext.mounted = false;
      requestRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    const isLatest = () => isCurrent() && request === requestRef.current;
    const confirmedUserId = confirmedServerUserId(
      confirmedServerIdentityRef.current,
      context,
    );
    setIsQuerying(true);
    updateSnapshot((current) =>
      isSameLocalContext(current, context) &&
      (current?.verification || current?.code || current?.result)
        ? { ...current, ...context, error: undefined }
        : context,
    );
    // A slow or failed offer preview must not delay the login check.
    void backgroundApiProxy.servicePrime
      .apiGetPrimeGiftEligibility({ serialNo })
      .then((eligibility) => {
        if (isLatest()) {
          updateSnapshot((current) => ({
            ...current,
            ...context,
            eligibility,
          }));
        }
      })
      .catch(() => undefined);
    try {
      const onekeyUserId =
        await backgroundApiProxy.servicePrime.apiGetPrimeGiftUserId();
      if (isLatest()) {
        const identityReset = isServerIdentityReset(
          confirmedUserId,
          onekeyUserId,
        );
        if (identityReset) serverIdentityGenerationRef.current += 1;
        confirmedServerIdentityRef.current = { ...context, onekeyUserId };
        updateSnapshot((current) =>
          snapshotForUser(current, context, onekeyUserId, identityReset),
        );
      }
    } catch (error) {
      if (isLatest() && localIsLoggedIn) {
        const presentation = getPrimeRedemptionErrorPresentation({
          error,
          fallbackMessage: message(ETranslations.prime_gift_error__msg),
        });
        updateSnapshot((current) => ({
          ...current,
          ...context,
          error: presentation.message,
        }));
      }
    } finally {
      if (isLatest()) setIsQuerying(false);
    }
  }, [serialNo, localIsLoggedIn, isCurrent, message, context, updateSnapshot]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestRef.current += 1;
      };
    }, [refresh]),
  );

  const finishSubmitting = useCallback(() => {
    submittingRef.current = false;
    if (contextRef.current.mounted) setIsSubmitting(false);
  }, []);
  const current = isSameLocalContext(snapshot, context) ? snapshot : undefined;
  const onekeyUserId = current?.onekeyUserId;
  const eligibility = eligibilityBySerialNo[serialNo] ?? current?.eligibility;
  const submit = useCallback(async () => {
    if (submittingRef.current || !onekeyUserId || !isCurrent()) return;
    if (readClaimableCode(snapshotRef.current)) return;
    const identity: IServerIdentity = {
      onekeyUserId,
      generation: serverIdentityGenerationRef.current,
    };
    const isOperationCurrent = () => matchesServerIdentity(identity);
    submittingRef.current = true;
    setIsSubmitting(true);
    updateSnapshot((value) => ({ ...value, ...context, error: undefined }));
    defaultLogger.prime.subscription.primeGiftStage({
      source,
      stage: 'verify',
      status: 'start',
    });
    try {
      const prepared =
        await backgroundApiProxy.servicePrime.apiPreparePrimeGiftRedemption({
          device,
          serialNo,
          expectedOneKeyUserId: onekeyUserId,
        });
      if (!isOperationCurrent()) return;
      const recorded = verificationRecord(
        snapshotRef.current,
        context,
        prepared,
        message(ETranslations.prime_gift_already_claimed__msg),
      );
      updateSnapshot(() => recorded.snapshot);
      defaultLogger.prime.subscription.primeGiftStage({
        source,
        stage: 'verify',
        status:
          recorded.status === 'redeemed' ? 'alreadyClaimed' : recorded.status,
      });
    } catch (error) {
      if (isOperationCurrent()) {
        const isCancel = isPrimeGiftVerifyCancellationError(error);
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'verify',
          status: isCancel ? 'cancel' : 'failed',
        });
        updateSnapshot((value) => ({
          ...value,
          ...context,
          error: isCancel
            ? undefined
            : getPrimeRedemptionErrorPresentation({
                error,
                fallbackMessage: message(ETranslations.prime_gift_error__msg),
              }).message,
        }));
      }
    } finally {
      finishSubmitting();
    }
  }, [
    device,
    serialNo,
    context,
    onekeyUserId,
    isCurrent,
    matchesServerIdentity,
    message,
    source,
    updateSnapshot,
    finishSubmitting,
  ]);

  const claim = useCallback(async () => {
    const active = snapshotRef.current;
    const code = readClaimableCode(active);
    const claimUserId = active?.onekeyUserId;
    if (submittingRef.current || !code || !claimUserId || !isCurrent()) return;
    const identity: IServerIdentity = {
      onekeyUserId: claimUserId,
      generation: serverIdentityGenerationRef.current,
    };
    const isOperationCurrent = () => matchesServerIdentity(identity);
    // Confirmation lives only on this snapshot. A server-identity reset or a
    // different account/device cannot reuse an earlier warning.
    const skipPendingCheck = Boolean(
      isSameLocalContext(active, context) && active?.isPendingPaymentConfirm,
    );
    submittingRef.current = true;
    setIsSubmitting(true);
    updateSnapshot((value) => ({
      ...value,
      ...context,
      error: undefined,
      isPendingPaymentConfirm: false,
    }));
    try {
      const blocked = await blockClaimForPendingPayment({
        skipPendingCheck,
        claimUserId,
        isOperationCurrent,
        message,
        updateSnapshot,
        context,
      });
      if (blocked || !isOperationCurrent()) return;
      const outcome = await requestPrimeRedemption({
        code,
        expectedOneKeyUserId: claimUserId,
        isPrimeActiveBeforeRedeem: Boolean(user?.primeSubscription?.isActive),
        primeGiftSerialNo: serialNo,
        giftSource: source,
        fallbackMessage: message(ETranslations.redemption_invalid_code_error),
      });
      if (!isOperationCurrent()) return;
      const next = redemptionSnapshot({
        current: snapshotRef.current,
        context,
        outcome,
        claimUserId,
        serialNo,
        email: user?.displayEmail ?? user?.email,
      });
      if (next) updateSnapshot(() => next);
    } finally {
      finishSubmitting();
    }
  }, [
    context,
    serialNo,
    isCurrent,
    matchesServerIdentity,
    message,
    source,
    updateSnapshot,
    finishSubmitting,
    user?.primeSubscription?.isActive,
    user?.displayEmail,
    user?.email,
  ]);

  const login = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    defaultLogger.prime.subscription.primeGiftStage({
      source,
      stage: 'login',
      status: 'start',
    });
    const loginSerialNo = serialNo;
    try {
      await loginOneKeyId();
      if (
        contextRef.current.mounted &&
        contextRef.current.serialNo === loginSerialNo
      ) {
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'login',
          status: 'success',
        });
      }
      if (isCurrent()) {
        await refresh();
      }
    } catch (error) {
      if (isCurrent()) {
        const isCancel = errorToastUtils.isUserCancelStyleError(error);
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'login',
          status: isCancel ? 'cancel' : 'failed',
        });
        if (!isCancel) {
          updateSnapshot((value) => ({
            ...value,
            ...context,
            error: getPrimeRedemptionErrorPresentation({
              error,
              fallbackMessage: message(ETranslations.prime_gift_error__msg),
            }).message,
          }));
        }
      }
    } finally {
      finishSubmitting();
    }
  }, [
    loginOneKeyId,
    refresh,
    isCurrent,
    serialNo,
    context,
    message,
    source,
    updateSnapshot,
    finishSubmitting,
  ]);
  return {
    user,
    isLoggedIn: Boolean(!isQuerying && onekeyUserId),
    onekeyUserId,
    eligibility,
    deviceVerified: Boolean(current?.verification || current?.result),
    verification: current?.verification,
    code: readClaimableCode(current),
    isPendingPaymentConfirm: Boolean(current?.isPendingPaymentConfirm),
    result: current?.result,
    error: current?.error,
    isQuerying,
    isSubmitting,
    refresh,
    submit,
    claim,
    login,
  };
}

async function blockClaimForPendingPayment({
  skipPendingCheck,
  claimUserId,
  isOperationCurrent,
  message,
  updateSnapshot,
  context,
}: {
  skipPendingCheck: boolean;
  claimUserId: string;
  isOperationCurrent: () => boolean;
  message: (id: ETranslations) => string;
  updateSnapshot: (
    updater: (
      current: IClaimSnapshot | undefined,
    ) => IClaimSnapshot | undefined,
  ) => void;
  context: IClaimContext;
}) {
  if (skipPendingCheck) return false;
  const entryGuard = await readPrimeInfiniPaymentEntryGuard();
  if (!isOperationCurrent()) return true;
  if (!entryGuard?.isLoggedIn || entryGuard.onekeyUserId !== claimUserId) {
    updateSnapshot((value) => ({
      ...value,
      ...context,
      error: message(ETranslations.global_unknown_error_retry_message),
      isPendingPaymentConfirm: false,
    }));
    return true;
  }
  if (!entryGuard.hasPendingPayment) return false;
  updateSnapshot((value) => ({
    ...value,
    ...context,
    error: undefined,
    isPendingPaymentConfirm: true,
  }));
  return true;
}
