import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimeGiftEligibilityPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import type {
  IPrimeGiftClaimResult,
  IPrimeGiftDeviceVerification,
  IPrimeGiftEligibility,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { showPrimeRedemptionDialog } from '../pages/PrimeDashboard/PrimeRedemptionDialog';

import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';
import { usePrimeGiftMessages } from './usePrimeGiftMessages';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IClaimSnapshot = {
  serialNo: string;
  localUserId?: string;
  localIsLoggedIn?: boolean;
  onekeyUserId?: string;
  eligibility?: IPrimeGiftEligibility;
  verification?: IPrimeGiftDeviceVerification;
  result?: IPrimeGiftClaimResult;
  error?: string;
};

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
  const submittingRef = useRef(false);
  const redemptionDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<IClaimSnapshot>();
  const [isQuerying, setIsQuerying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCurrent = useCallback(
    () =>
      contextRef.current.mounted &&
      contextRef.current.serialNo === serialNo &&
      contextRef.current.localUserId === localUserId &&
      contextRef.current.localIsLoggedIn === localIsLoggedIn,
    [serialNo, localUserId, localIsLoggedIn],
  );
  useEffect(() => {
    const context = contextRef.current;
    context.mounted = true;
    return () => {
      context.mounted = false;
      requestRef.current += 1;
    };
  }, []);
  useEffect(
    () => () => {
      const dialog = redemptionDialogRef.current;
      redemptionDialogRef.current = undefined;
      if (dialog) void Promise.resolve(dialog.close()).catch(() => undefined);
    },
    [serialNo, localUserId, localIsLoggedIn],
  );

  const refresh = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    const isLatest = () => isCurrent() && request === requestRef.current;
    setIsQuerying(true);
    setSnapshot({ serialNo, localUserId, localIsLoggedIn });
    // A slow or failed offer preview must not delay the login check.
    void backgroundApiProxy.servicePrime
      .apiGetPrimeGiftEligibility({ serialNo })
      .then((eligibility) => {
        if (isLatest()) {
          setSnapshot((current) => ({
            ...current,
            serialNo,
            localUserId,
            localIsLoggedIn,
            eligibility,
          }));
        }
      })
      .catch(() => undefined);
    try {
      const onekeyUserId =
        await backgroundApiProxy.servicePrime.apiGetPrimeGiftUserId();
      if (isLatest()) {
        setSnapshot((current) => ({
          ...current,
          serialNo,
          localUserId,
          localIsLoggedIn,
          onekeyUserId,
        }));
      }
    } catch (error) {
      if (isLatest() && localIsLoggedIn) {
        setSnapshot((current) => ({
          ...current,
          serialNo,
          localUserId,
          localIsLoggedIn,
          error: getPrimeRedemptionErrorPresentation({
            error,
            fallbackMessage: message(ETranslations.prime_gift_error__msg),
          }).message,
        }));
      }
    } finally {
      if (isLatest()) setIsQuerying(false);
    }
  }, [serialNo, localUserId, localIsLoggedIn, isCurrent, message]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestRef.current += 1;
      };
    }, [refresh]),
  );

  const current =
    snapshot?.serialNo === serialNo &&
    snapshot.localUserId === localUserId &&
    snapshot.localIsLoggedIn === localIsLoggedIn
      ? snapshot
      : undefined;
  const onekeyUserId = current?.onekeyUserId;
  const eligibility = eligibilityBySerialNo[serialNo] ?? current?.eligibility;
  const submit = useCallback(async () => {
    if (
      submittingRef.current ||
      redemptionDialogRef.current?.isExist() ||
      !onekeyUserId ||
      !isCurrent()
    )
      return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSnapshot((value) => ({
      ...value,
      serialNo,
      localUserId,
      error: undefined,
    }));
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
      if (!isCurrent()) return;
      const isAlreadyRedeemed = prepared.verification.status === 'redeemed';
      setSnapshot((value) => ({
        ...value,
        serialNo,
        localUserId,
        localIsLoggedIn,
        verification: prepared.verification,
        error: isAlreadyRedeemed
          ? message(ETranslations.prime_gift_already_claimed__msg)
          : undefined,
      }));
      if (isAlreadyRedeemed) {
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'verify',
          status: 'alreadyClaimed',
        });
        return;
      }
      if (!prepared.code?.trim()) {
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'verify',
          status: 'noCode',
        });
        return;
      }
      defaultLogger.prime.subscription.primeGiftStage({
        source,
        stage: 'verify',
        status: 'success',
      });
      redemptionDialogRef.current = showPrimeRedemptionDialog({
        expectedOneKeyUserId: onekeyUserId,
        initialCode: prepared.code,
        primeGiftSerialNo: serialNo,
        giftSource: source,
        isPrimeActiveBeforeRedeem: Boolean(user?.primeSubscription?.isActive),
        onRedeemed: (redemption) => {
          if (!isCurrent()) return;
          setSnapshot((value) => ({
            ...value,
            serialNo,
            localUserId,
            localIsLoggedIn,
            result: {
              ...redemption,
              serialNo,
              onekeyUserId,
              giftMonths:
                redemption.addedDays === eligibility?.giftDays
                  ? eligibility?.giftMonths
                  : undefined,
              email: user?.displayEmail ?? user?.email,
            },
            error: undefined,
          }));
        },
      });
    } catch (error) {
      if (isCurrent()) {
        const isCancel = errorToastUtils.isUserCancelStyleError(error);
        defaultLogger.prime.subscription.primeGiftStage({
          source,
          stage: 'verify',
          status: isCancel ? 'cancel' : 'failed',
        });
        setSnapshot((value) => ({
          ...value,
          serialNo,
          localUserId,
          localIsLoggedIn,
          error: isCancel
            ? undefined
            : getPrimeRedemptionErrorPresentation({
                error,
                fallbackMessage: message(ETranslations.prime_gift_error__msg),
              }).message,
        }));
      }
    } finally {
      submittingRef.current = false;
      if (contextRef.current.mounted) setIsSubmitting(false);
    }
  }, [
    device,
    serialNo,
    localUserId,
    localIsLoggedIn,
    onekeyUserId,
    isCurrent,
    message,
    user?.primeSubscription?.isActive,
    user?.displayEmail,
    user?.email,
    eligibility,
    source,
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
          setSnapshot((value) => ({
            ...value,
            serialNo,
            localUserId,
            localIsLoggedIn,
            error: getPrimeRedemptionErrorPresentation({
              error,
              fallbackMessage: message(ETranslations.prime_gift_error__msg),
            }).message,
          }));
        }
      }
    } finally {
      submittingRef.current = false;
      if (contextRef.current.mounted) setIsSubmitting(false);
    }
  }, [
    loginOneKeyId,
    refresh,
    isCurrent,
    serialNo,
    localUserId,
    localIsLoggedIn,
    message,
    source,
  ]);
  return {
    user,
    isLoggedIn: Boolean(!isQuerying && onekeyUserId),
    onekeyUserId,
    eligibility,
    deviceVerified: Boolean(current?.verification || current?.result),
    verification: current?.verification,
    result: current?.result,
    error: current?.error,
    isQuerying,
    isSubmitting,
    refresh,
    submit,
    login,
  };
}
