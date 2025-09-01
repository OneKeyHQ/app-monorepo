import { useCallback } from 'react';

import {
  Divider,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import {
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';
import { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';
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
          <Stack flex={1} minHeight={300}>
            {networkId && tokenDetail?.symbol ? (
              <MarketTradingView
                tokenAddress={tokenAddress}
                networkId={networkId}
                tokenSymbol={tokenDetail?.symbol}
              />
            ) : null}
          </Stack>

          {/* Info tabs */}
          {tokenDetail?.address ? (
            <Stack h="30vh">
              <DesktopInformationTabs />
            </Stack>
          ) : null}
        </YStack>

        {/* Right column */}
        {tokenDetail?.address ? (
          <Stack w={320}>
            <ScrollView>
              <Stack w={320}>
                <Stack px="$5" py="$4">
                  <SwapPanel
                    networkId={networkId}
                    tokenAddress={tokenDetail?.address}
                  />
                </Stack>

                <Divider mx="$5" my="$2" />

                <TokenActivityOverview />
              </Stack>
            </ScrollView>
          </Stack>
        ) : null}
      </XStack>
    </>
  );
}
