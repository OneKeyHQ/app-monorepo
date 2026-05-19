import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog, Heading, Icon, Stack } from '@onekeyhq/components';
import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
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
  const intl = useIntl();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [tradesData] = usePerpsTradesHistoryDataAtom();
  const { shareReferRewards } = useReferFriends();
  const hasShownRef = useRef(false);
  const checkingRef = useRef(false);
  const hasBeenFocusedRef = useRef(false);
  const isFocusedRef = useRef(false);
  const pendingLoadRef = useRef(false);
  const pendingCheckRef = useRef(false);
  const currentAccountAddressRef = useRef(currentAccount?.accountAddress);
  currentAccountAddressRef.current = currentAccount?.accountAddress;

  useEffect(() => {
    const accountAddress = currentAccount?.accountAddress;
    if (!accountAddress) {
      return;
    }
    if (
      !tradesData?.isLoaded ||
      tradesData?.accountAddress?.toLowerCase() !== accountAddress.toLowerCase()
    ) {
      if (!hasBeenFocusedRef.current) {
        pendingLoadRef.current = true;
        return;
      }
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
    if (!isFocusedRef.current) {
      pendingCheckRef.current = true;
      return;
    }

    const fills = tradesData?.fills?.filter(
      (fill) => !isSpotInstrument(fill.coin),
    );
    if (
      !fills ||
      !tradesData?.isLoaded ||
      tradesData?.accountAddress?.toLowerCase() !== accountAddress.toLowerCase()
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
      const hasPromptShown =
        await backgroundApiProxy.simpleDb.perp.getPerpsSharePromptShown();
      if (hasPromptShown) {
        return;
      }

      // Re-check focus after async gap — user may have navigated away
      if (!isFocusedRef.current) {
        pendingCheckRef.current = true;
        return;
      }

      if (hasShownRef.current) {
        return;
      }

      hasShownRef.current = true;

      Dialog.show({
        showExitButton: true,
        renderContent: (
          <>
            <Stack
              alignSelf="flex-start"
              p="$3"
              mt="$-5"
              mb="$5"
              borderRadius="$full"
              bg="$bgStrong"
            >
              <Icon name="ShareOutline" size="$8" />
            </Stack>
            <Heading
              size="$headingXl"
              py="$px"
              style={{ whiteSpace: 'pre-line' }}
            >
              {intl.formatMessage({
                id: ETranslations.perps_enjoy_perps,
              })}
            </Heading>
          </>
        ),
        onCancelText: intl.formatMessage({
          id: ETranslations.global_later,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.explore_share,
        }),
        onClose: () => {
          void backgroundApiProxy.simpleDb.perp.setPerpsSharePromptShown(true);
        },
        onConfirm: () => {
          void shareReferRewards(undefined, undefined, 'Perps', true);
        },
      });
    } finally {
      checkingRef.current = false;
    }
  }, [currentAccount?.accountAddress, tradesData, shareReferRewards, intl]);

  const checkAndShowPromptRef = useRef(checkAndShowPrompt);
  checkAndShowPromptRef.current = checkAndShowPrompt;

  useListenTabFocusState(ETabRoutes.Perp, (isFocus, isHideByModal) => {
    isFocusedRef.current = isFocus && !isHideByModal;
    if (!isFocusedRef.current) {
      return;
    }
    if (!hasBeenFocusedRef.current) {
      hasBeenFocusedRef.current = true;
      if (pendingLoadRef.current) {
        pendingLoadRef.current = false;
        const accountAddress = currentAccountAddressRef.current;
        if (accountAddress) {
          void backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
            accountAddress,
          );
        }
      }
    }
    if (pendingCheckRef.current) {
      pendingCheckRef.current = false;
      void checkAndShowPromptRef.current();
    }
  });

  useEffect(() => {
    if (!hasBeenFocusedRef.current) {
      pendingCheckRef.current = true;
      return;
    }
    void checkAndShowPrompt();
  }, [checkAndShowPrompt]);
}
