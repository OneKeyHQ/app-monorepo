import { Stack, XStack, YStack } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

import {
  InformationTabs,
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
            <TradingView
              version="v2"
              mode="realtime"
              identifier="OneKey"
              baseToken={tokenDetail?.symbol ?? ''}
              targetToken="USDT"
              tokenAddress={tokenAddress}
              networkId={networkId}
              onLoadEnd={() => {}}
            />
          </Stack>

          {/* Info tabs */}
          <Stack h={300}>
            <InformationTabs />
          </Stack>
        </YStack>

        {/* Right column */}
        <Stack w="$100">
          <SwapPanel />

          <TokenActivityOverview />
        </Stack>
      </XStack>
    </>
  );
}
