import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type {
  IPrimeGiftAccountEligibility,
  IPrimeGiftClaimResult,
  IPrimeGiftEligibility,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';
import { usePrimeGiftMessages } from './usePrimeGiftMessages';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IClaimSnapshot = {
  serialNo: string;
  onekeyUserId?: string;
  eligibility?: IPrimeGiftEligibility;
  accountEligibility?: IPrimeGiftAccountEligibility;
  deviceVerified?: boolean;
  result?: IPrimeGiftClaimResult;
  error?: string;
};

export function usePrimeGiftClaim({
  device,
  serialNo,
}: {
  device: Omit<SearchDevice, 'commType'>;
  serialNo: string;
}) {
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const message = usePrimeGiftMessages();
  const onekeyUserId = isLoggedIn ? user?.onekeyUserId : undefined;
  const contextRef = useRef({ serialNo, onekeyUserId, mounted: true });
  contextRef.current.serialNo = serialNo;
  contextRef.current.onekeyUserId = onekeyUserId;
  const requestRef = useRef(0);
  const submittingRef = useRef(false);
  const [snapshot, setSnapshot] = useState<IClaimSnapshot>();
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [isQuerying, setIsQuerying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    const context = contextRef.current;
    context.mounted = true;
    return () => {
      context.mounted = false;
      requestRef.current += 1;
    };
  }, []);
  const isCurrent = useCallback(
    () =>
      contextRef.current.mounted &&
      contextRef.current.serialNo === serialNo &&
      contextRef.current.onekeyUserId === onekeyUserId,
    [serialNo, onekeyUserId],
  );
  const refresh = useCallback(
    async (preserveOutcome = false) => {
      if (submittingRef.current) return;
      requestRef.current += 1;
      const request = requestRef.current;
      const previous = snapshotRef.current;
      const sameContext =
        previous?.serialNo === serialNo &&
        previous.onekeyUserId === onekeyUserId;
      if (sameContext && previous.result) {
        setIsQuerying(false);
        return;
      }
      const next: IClaimSnapshot = {
        serialNo,
        onekeyUserId,
        error: preserveOutcome && sameContext ? previous.error : undefined,
      };
      setIsQuerying(true);
      try {
        next.eligibility =
          await backgroundApiProxy.servicePrime.apiGetPrimeGiftEligibility({
            serialNo,
          });
        if (!isCurrent() || request !== requestRef.current) return;
        if (onekeyUserId) {
          const restored =
            await backgroundApiProxy.servicePrime.apiGetPrimeGiftClaimResult({
              serialNo,
              expectedOneKeyUserId: onekeyUserId,
            });
          if (
            restored &&
            (restored.serialNo !== serialNo ||
              restored.onekeyUserId !== onekeyUserId)
          ) {
            throw new OneKeyLocalError(
              message(ETranslationsMock.prime_gift_session_changed),
            );
          }
          next.result = restored;
          if (!next.result && next.eligibility.canClaim) {
            const progress =
              await backgroundApiProxy.servicePrime.apiGetPrimeGiftClaimProgress(
                {
                  serialNo,
                  expectedOneKeyUserId: onekeyUserId,
                },
              );
            next.deviceVerified = progress.deviceVerified;
            next.accountEligibility =
              await backgroundApiProxy.servicePrime.apiCheckPrimeGiftAccountEligibility(
                { expectedOneKeyUserId: onekeyUserId },
              );
          }
        }
      } catch (error) {
        next.error =
          next.error ||
          getPrimeRedemptionErrorPresentation({
            error,
            fallbackMessage: message(ETranslationsMock.prime_gift_error),
          }).message;
      } finally {
        if (isCurrent() && request === requestRef.current) {
          setSnapshot(next);
          setIsQuerying(false);
        }
      }
    },
    [serialNo, onekeyUserId, isCurrent, message],
  );
  useFocusEffect(
    useCallback(() => {
      if (!isSubmitting) void refresh(true);
    }, [refresh, isSubmitting]),
  );

  const submit = useCallback(async () => {
    if (submittingRef.current || !onekeyUserId || !isCurrent()) return;
    submittingRef.current = true;
    requestRef.current += 1;
    setIsSubmitting(true);
    setIsQuerying(false);
    setSnapshot((current) => ({
      ...current,
      serialNo,
      onekeyUserId,
      error: undefined,
    }));
    try {
      const result = await backgroundApiProxy.servicePrime.apiClaimPrimeGift({
        device,
        serialNo,
        expectedOneKeyUserId: onekeyUserId,
      });
      if (!isCurrent()) return;
      if (
        result.serialNo !== serialNo ||
        result.onekeyUserId !== onekeyUserId
      ) {
        throw new OneKeyLocalError(
          message(ETranslationsMock.prime_gift_session_changed),
        );
      }
      setSnapshot((current) => ({
        ...current,
        serialNo,
        onekeyUserId,
        result,
      }));
      appEventBus.emit(EAppEventBusNames.PrimeGiftRedeemed, { serialNo });
      // The confirmed redemption result remains valid if a profile refresh fails.
      void backgroundApiProxy.servicePrime
        .apiFetchPrimeUserInfo({ forceRefresh: true })
        .catch(() => undefined);
    } catch (error) {
      if (isCurrent()) {
        const result = await backgroundApiProxy.servicePrime
          .apiGetPrimeGiftClaimResult({
            serialNo,
            expectedOneKeyUserId: onekeyUserId,
          })
          .catch(() => undefined);
        if (!isCurrent()) return;
        if (
          result?.serialNo === serialNo &&
          result.onekeyUserId === onekeyUserId
        ) {
          setSnapshot((current) => ({
            ...current,
            serialNo,
            onekeyUserId,
            result,
            error: undefined,
          }));
          appEventBus.emit(EAppEventBusNames.PrimeGiftRedeemed, { serialNo });
        } else {
          setSnapshot((current) => ({
            ...current,
            serialNo,
            onekeyUserId,
            error: errorToastUtils.isUserCancelStyleError(error)
              ? undefined
              : getPrimeRedemptionErrorPresentation({
                  error,
                  fallbackMessage: message(ETranslationsMock.prime_gift_error),
                }).message,
          }));
        }
      }
    } finally {
      submittingRef.current = false;
      if (contextRef.current.mounted) setIsSubmitting(false);
    }
  }, [device, serialNo, onekeyUserId, isCurrent, message]);

  const login = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await loginOneKeyId();
    } catch (error) {
      if (isCurrent() && !errorToastUtils.isUserCancelStyleError(error)) {
        setSnapshot((current) => ({
          ...current,
          serialNo,
          onekeyUserId,
          error: getPrimeRedemptionErrorPresentation({
            error,
            fallbackMessage: message(ETranslationsMock.prime_gift_error),
          }).message,
        }));
      }
    } finally {
      submittingRef.current = false;
      if (contextRef.current.mounted) setIsSubmitting(false);
    }
  }, [loginOneKeyId, isCurrent, serialNo, onekeyUserId, message]);
  // Identity can change before effects run; never render the previous account's result.
  const current =
    snapshot?.serialNo === serialNo && snapshot.onekeyUserId === onekeyUserId
      ? snapshot
      : undefined;
  return {
    user,
    isLoggedIn,
    onekeyUserId,
    eligibility: current?.eligibility,
    accountEligibility: current?.accountEligibility,
    deviceVerified: Boolean(current?.deviceVerified || current?.result),
    result: current?.result,
    error: current?.error,
    isQuerying,
    isSubmitting,
    refresh,
    submit,
    login,
  };
}
