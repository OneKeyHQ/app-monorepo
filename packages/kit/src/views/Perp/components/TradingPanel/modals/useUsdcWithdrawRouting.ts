import { useEffect, useMemo, useRef, useState } from 'react';

import { onVisibilityStateChange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  usePerpsCommonConfigPersistAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  DEFAULT_USDC_WITHDRAW_DESTINATION_ID,
  USDC_WITHDRAW_DESTINATIONS,
  getUsdcWithdrawDestination,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export function useUsdcWithdrawRouting({
  enabled,
  isSubmitting,
  onRoutingChange,
}: {
  enabled: boolean;
  isSubmitting: boolean;
  onRoutingChange: () => void;
}) {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const serverForceLegacy = perpConfigCommon.withdrawChannel === 'legacy';
  const [forceLegacyUsdcWithdraw, setForceLegacyUsdcWithdraw] =
    useState(serverForceLegacy);

  // Keep the form stable while the user is signing. The background validates
  // the current policy before signing and never changes an in-flight action.
  useEffect(() => {
    if (!isSubmitting) {
      setForceLegacyUsdcWithdraw(serverForceLegacy);
    }
  }, [isSubmitting, serverForceLegacy]);

  const previousResultRef = useRef<
    { route: 'bridge' | 'cctp'; forceLegacyUsdcWithdraw: boolean } | undefined
  >(undefined);
  const { result, run: refreshWithdrawRoute } = usePromiseResult(
    async () => {
      if (!enabled || isSubmitting) {
        return undefined;
      }
      try {
        const route =
          await backgroundApiProxy.serviceHyperliquidExchange.getUsdcWithdrawRoute(
            { forceRefresh: true },
          );
        return { route, forceLegacyUsdcWithdraw };
      } catch {
        // Automatic refreshes may fail offline. Keep the last accepted quote;
        // policy matching below and submission-time validation still apply.
        return previousResultRef.current;
      }
    },
    [enabled, isSubmitting, forceLegacyUsdcWithdraw],
    {
      pollingInterval: 30_000,
      overrideIsFocused: (focused) => focused && enabled && !isSubmitting,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  useEffect(() => {
    previousResultRef.current = result;
  }, [result]);
  useEffect(
    () =>
      onVisibilityStateChange((visible) => {
        if (visible && enabled && !isSubmitting) {
          void refreshWithdrawRoute();
        }
      }),
    [enabled, isSubmitting, refreshWithdrawRoute],
  );
  // A late quote obtained under a different policy is not eligible for display
  // or submission, including a bridge result after the override is removed.
  let withdrawRoute =
    result?.forceLegacyUsdcWithdraw === forceLegacyUsdcWithdraw
      ? result.route
      : undefined;
  if (forceLegacyUsdcWithdraw) {
    withdrawRoute = 'bridge';
  }
  const withdrawDestinationId =
    forceLegacyUsdcWithdraw ||
    !getUsdcWithdrawDestination(settings.lastUsdcWithdrawDestinationId)
      ? DEFAULT_USDC_WITHDRAW_DESTINATION_ID
      : settings.lastUsdcWithdrawDestinationId;
  const previousRoutingRef = useRef({
    forceLegacyUsdcWithdraw,
    route: withdrawRoute,
  });

  useEffect(() => {
    if (!enabled || isSubmitting) {
      return;
    }
    const previous = previousRoutingRef.current;
    if (
      previous.forceLegacyUsdcWithdraw !== forceLegacyUsdcWithdraw ||
      (previous.route && withdrawRoute && previous.route !== withdrawRoute)
    ) {
      onRoutingChange();
    }
    previousRoutingRef.current = {
      forceLegacyUsdcWithdraw,
      route: withdrawRoute,
    };
    if (
      forceLegacyUsdcWithdraw &&
      settings.lastUsdcWithdrawDestinationId !== 'arbitrum'
    ) {
      setSettings((current) => ({
        ...current,
        lastUsdcWithdrawDestinationId: 'arbitrum',
      }));
    }
  }, [
    enabled,
    isSubmitting,
    forceLegacyUsdcWithdraw,
    withdrawRoute,
    onRoutingChange,
    settings.lastUsdcWithdrawDestinationId,
    setSettings,
  ]);

  const withdrawDestinations = useMemo(
    () =>
      forceLegacyUsdcWithdraw
        ? USDC_WITHDRAW_DESTINATIONS.filter(({ id }) => id === 'arbitrum')
        : USDC_WITHDRAW_DESTINATIONS,
    [forceLegacyUsdcWithdraw],
  );

  return {
    withdrawRoute,
    withdrawDestinationId,
    withdrawDestinations,
    refreshWithdrawRoute,
  };
}
