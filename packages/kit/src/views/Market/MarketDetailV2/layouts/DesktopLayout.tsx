import { useCallback } from 'react';

import { Divider, Stack, XStack, YStack } from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import {
  InformationTabs,
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';
import { useTokenDetail } from '../hooks/useTokenDetail';

import type { LayoutChangeEvent } from 'react-native';

export function DesktopLayout() {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
  const [, setLeftColumnWidth] = useLeftColumnWidthAtom();

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      setLeftColumnWidth(width);
    },
    [setLeftColumnWidth],
  );

  return (
    <>
      {/* Header */}
      <TokenDetailHeader />

      {/* Main Content */}
      <XStack flex={1}>
        {/* Left column */}
        <YStack flex={1} onLayout={handleLayout}>
          {/* Trading view */}
          <Stack flex={1}>
            <MarketTradingView
              tokenAddress={tokenAddress}
              networkId={networkId}
              tokenSymbol={tokenDetail?.symbol}
            />
          </Stack>

          {/* Info tabs */}
          <Stack h={320}>
            <InformationTabs />
          </Stack>
        </YStack>

        {/* Right column */}
        <Stack w={320}>
          <SwapPanel
            networkId={networkId}
            tokenAddress={tokenDetail?.address}
          />

          <Divider mx="$4" my="$2" />

          <TokenActivityOverview />
        </Stack>
      </XStack>
    </>
  );
}
