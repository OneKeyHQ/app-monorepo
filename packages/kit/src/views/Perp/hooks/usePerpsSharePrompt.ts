import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { Dialog } from '@onekeyhq/components';
import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useReferFriends } from '../../../hooks/useReferFriends';

const SHARE_PROMPT_MIN_TRADES = 3;
const SHARE_PROMPT_MIN_VOLUME = 100_000;

function calculateTotalVolume(fills: { sz: string; px: string }[]): BigNumber {
  let total = new BigNumber(0);
  for (const fill of fills) {
    total = total.plus(new BigNumber(fill.sz).multipliedBy(fill.px));
  }
  return total;
}

export function usePerpsSharePrompt() {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [tradesData] = usePerpsTradesHistoryDataAtom();
  const { shareReferRewards } = useReferFriends();
  const hasShownRef = useRef(false);
  const optedOutCacheRef = useRef<Record<string, boolean>>({});
  const checkingRef = useRef(false);
  const prevAccountRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (
      prevAccountRef.current !== undefined &&
      prevAccountRef.current !== currentAccount?.accountAddress
    ) {
      hasShownRef.current = false;
    }
    prevAccountRef.current = currentAccount?.accountAddress;
  }, [currentAccount?.accountAddress]);

  useEffect(() => {
    const accountAddress = currentAccount?.accountAddress;
    if (!accountAddress) {
      return;
    }
    if (
      !tradesData?.isLoaded ||
      tradesData?.accountAddress?.toLowerCase() !== accountAddress.toLowerCase()
    ) {
      void backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
        accountAddress,
      );
    }
  }, [
    currentAccount?.accountAddress,
    tradesData?.isLoaded,
    tradesData?.accountAddress,
  ]);

  const checkAndShowPrompt = useCallback(async () => {
    const accountAddress = currentAccount?.accountAddress;
    if (!accountAddress || hasShownRef.current || checkingRef.current) {
      return;
    }

    const addressKey = accountAddress.toLowerCase();

    if (optedOutCacheRef.current[addressKey]) {
      return;
    }

    const fills = tradesData?.fills;
    if (
      !fills ||
      !tradesData?.isLoaded ||
      tradesData?.accountAddress?.toLowerCase() !== addressKey
    ) {
      return;
    }

    if (fills.length < SHARE_PROMPT_MIN_TRADES) {
      return;
    }

    const totalVolume = calculateTotalVolume(fills);
    if (totalVolume.lt(SHARE_PROMPT_MIN_VOLUME)) {
      return;
    }

    checkingRef.current = true;
    try {
      const optedOut =
        await backgroundApiProxy.simpleDb.perp.getReferralPromptOptedOut(
          accountAddress,
        );
      if (optedOut) {
        optedOutCacheRef.current[addressKey] = true;
        return;
      }

      if (
        hasShownRef.current ||
        prevAccountRef.current?.toLowerCase() !== addressKey
      ) {
        return;
      }

      hasShownRef.current = true;

      Dialog.show({
        icon: 'ShareOutline',
        title: appLocale.intl.formatMessage({
          id: ETranslations.perps_enjoy_perps,
        }),
        onCancelText: appLocale.intl.formatMessage({
          id: ETranslations.global_later,
        }),
        onConfirmText: appLocale.intl.formatMessage({
          id: ETranslations.explore_share,
        }),
        onCancel: () => {
          void backgroundApiProxy.simpleDb.perp.setReferralPromptOptedOut(
            accountAddress,
            true,
          );
        },
        onConfirm: () => {
          void backgroundApiProxy.simpleDb.perp.setReferralPromptOptedOut(
            accountAddress,
            true,
          );
          void shareReferRewards(undefined, undefined, 'Perps', true);
        },
      });
    } finally {
      checkingRef.current = false;
    }
  }, [currentAccount?.accountAddress, tradesData, shareReferRewards]);

  useEffect(() => {
    void checkAndShowPrompt();
  }, [checkAndShowPrompt]);
}
