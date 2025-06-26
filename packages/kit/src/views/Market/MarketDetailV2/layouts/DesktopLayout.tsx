import { Divider, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  InformationTabs,
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function DesktopLayout() {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();

  return (
    <>
      {/* Header */}
      <TokenDetailHeader />

      {/* Main Content */}
      <XStack flex={1}>
        {/* Left column */}
        <YStack flex={1}>
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
          <SwapPanel />

          <Divider mx="$4" my="$2" />

          <TokenActivityOverview />
        </Stack>
      </XStack>
    </>
  );
}
