import {
  Divider,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';
import { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function DesktopLayout({ isNative = false }: { isNative?: boolean }) {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();

  return (
    <>
      {/* Header */}
      <TokenDetailHeader isNative={isNative} />

      {/* Main Content */}
      <XStack flex={1}>
        {/* Left column */}
        <YStack flex={1}>
          {/* Trading view */}
          <Stack flex={1} minHeight={300}>
            {networkId && tokenDetail?.symbol ? (
              <MarketTradingView
                tokenAddress={tokenAddress}
                networkId={networkId}
                tokenSymbol={tokenDetail?.symbol}
                isNative={isNative}
              />
            ) : null}
          </Stack>

          {/* Info tabs */}
          {!isNative ? (
            <Stack h="30vh">
              <DesktopInformationTabs />
            </Stack>
          ) : null}
        </YStack>

        {/* Right column */}
        {!isNative ? (
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
