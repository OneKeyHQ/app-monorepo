import { useMemo } from 'react';

import {
  Dialog,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';

import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { useEarnDesktopWalletHoldings } from '../../components/desktopHome/useEarnDesktopHomeData';

import { listPayTokens, pickDefaultPayToken } from './earnRouter.utils';

import type { IEarnRouterPayToken } from './earnRouter.utils';

// The wallet's tokens on the deposit's network, for Pay with
export function usePayTokens({
  networkId,
  depositSymbol,
  enabled = true,
}: {
  networkId: string;
  depositSymbol: string;
  enabled?: boolean;
}) {
  const refreshNetworkIds = useMemo(() => [networkId], [networkId]);
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const payableSymbols = useMemo(
    () =>
      new Set(
        Object.values(availableAssetsByType).flatMap((assets) =>
          (assets ?? []).map((asset) => asset.symbol.toLowerCase()),
        ),
      ),
    [availableAssetsByType],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: enabled,
    refreshNetworkIds,
  });
  const group = useMemo(
    () => wallet.networkGroups.find((item) => item.networkId === networkId),
    [networkId, wallet.networkGroups],
  );
  const tokens = useMemo(
    () =>
      listPayTokens({
        group,
        depositSymbol,
        // Before Earn's lists are in, nothing is filtered out
        payableSymbols: payableSymbols.size ? payableSymbols : undefined,
      }),
    [depositSymbol, group, payableSymbols],
  );
  const defaultToken = useMemo(() => pickDefaultPayToken(tokens), [tokens]);
  return {
    tokens,
    defaultToken,
    isLoaded: wallet.isLoaded,
    refresh: wallet.refresh,
  };
}

function PayTokenRow({
  item,
  isSelected,
  onSelect,
}: {
  item: IEarnRouterPayToken;
  isSelected: boolean;
  onSelect: (item: IEarnRouterPayToken) => void;
}) {
  const handlePress = () => onSelect(item);
  return (
    <XStack
      testID={`earn-router-pay-with-${item.token.symbol}`}
      role="button"
      aria-pressed={isSelected}
      ai="center"
      gap="$3"
      px="$3"
      py="$2.5"
      mx="$2"
      borderRadius="$3"
      borderCurve="continuous"
      bg={isSelected ? '$bgActive' : undefined}
      hoverStyle={{ bg: isSelected ? '$bgActive' : '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="pointer"
      userSelect="none"
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress)}
    >
      <Token size="md" tokenImageUri={item.token.logoURI} />
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {item.token.symbol}
        </SizableText>
        {/* A name that only repeats the symbol (sUSD3, USDe) says nothing */}
        {item.token.name &&
        item.token.name.toLowerCase() !== item.token.symbol.toLowerCase() ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {item.token.name}
          </SizableText>
        ) : null}
      </YStack>
      <YStack ai="flex-end" flexShrink={0}>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLgMedium"
          formatter="balance"
        >
          {item.amount}
        </NumberSizeableTextWrapper>
        <Currency
          hideValue
          size="$bodySm"
          color="$textSubdued"
          formatter="value"
          sourceCurrency={USD_CURRENCY_ID}
        >
          {item.fiatValueUsd}
        </Currency>
      </YStack>
    </XStack>
  );
}

// The token to pay with: the deposit token first, then what else the wallet
// holds on the same network
export function showPayWithPicker({
  tokens,
  selectedKey,
  onSelect,
}: {
  tokens: IEarnRouterPayToken[];
  selectedKey?: string;
  onSelect: (item: IEarnRouterPayToken) => void;
}) {
  // Shut with nothing changed (Escape, or the token already in use), the
  // focus goes back to where it was, the token chip, so the keyboard carries
  // on from there. Another token builds a new form, which takes the focus
  const opener = globalThis.document?.activeElement;
  let hasPicked = false;
  const dialog = Dialog.show({
    title: EARN_DESKTOP_DEMO_COPY.payWith,
    showFooter: false,
    contentContainerProps: { px: '$0', pb: '$5' },
    onClose: () => {
      if (
        !hasPicked &&
        typeof HTMLElement !== 'undefined' &&
        opener instanceof HTMLElement &&
        opener.isConnected
      ) {
        opener.focus();
      }
    },
    renderContent: (
      // A long wallet scrolls inside the dialog instead of growing past it
      <ScrollView maxHeight={440}>
        <YStack gap="$1">
          {tokens.map((item) => (
            <PayTokenRow
              key={item.key}
              item={item}
              isSelected={item.key === selectedKey}
              onSelect={(picked) => {
                // The token already in use changes nothing, the amount
                // typed included
                if (picked.key !== selectedKey) {
                  hasPicked = true;
                  onSelect(picked);
                }
                void dialog.close();
              }}
            />
          ))}
        </YStack>
      </ScrollView>
    ),
  });
  return dialog;
}
