import { Stack, XStack, YStack } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';
import type { IMarketTokenDetail as IMarketTokenDetailV2 } from '@onekeyhq/shared/types/marketV2';

import {
  InformationTabs,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';

interface IDesktopLayoutProps {
  tokenAddress: string;
  networkId: string;
  tokenDetail?: IMarketTokenDetailV2;
}

export function DesktopLayout({
  tokenAddress,
  networkId,
  tokenDetail,
}: IDesktopLayoutProps) {
  return (
    <>
      {/* Header */}
      <TokenDetailHeader tokenDetail={tokenDetail} networkId={networkId} />

      {/* Main Content */}
      <XStack flex={1}>
        {/* Left column */}
        <YStack flex={1}>
          {/* Trading view */}
          <Stack flex={1}>
            <TradingView
              mode="realtime"
              identifier="binance"
              baseToken={tokenDetail?.symbol ?? ''}
              targetToken="USDT"
              tokenAddress={tokenAddress}
              networkId={networkId}
              onLoadEnd={() => {}}
            />
          </Stack>

          {/* Info tabs */}
          <Stack h={300}>
            <InformationTabs
              tokenAddress={tokenAddress}
              networkId={networkId}
            />
          </Stack>
        </YStack>

        {/* Right column */}
        <Stack w="$100">
          <SwapPanel tokenDetail={tokenDetail} networkId={networkId} />

          <TokenActivityOverview tokenDetail={tokenDetail} />
        </Stack>
      </XStack>
    </>
  );
}
