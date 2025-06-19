import { ScrollView, Stack } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';
import type { IMarketTokenDetail as IMarketTokenDetailV2 } from '@onekeyhq/shared/types/marketV2';

import {
  InformationPanel,
  InformationTabs,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
} from '../components';

interface IMobileLayoutProps {
  tokenAddress: string;
  networkId: string;
  tokenDetail?: IMarketTokenDetailV2;
}

export function MobileLayout({
  tokenAddress,
  networkId,
  tokenDetail,
}: IMobileLayoutProps) {
  return (
    <>
      {/* Header */}
      <TokenDetailHeader
        tokenDetail={tokenDetail}
        networkId={networkId}
        showStats={false}
        showMediaAndSecurity={false}
      />

      {/* Information Panel */}
      <InformationPanel tokenDetail={tokenDetail} networkId={networkId} />

      {/* Main Content (temporary same as desktop; will adjust later) */}
      <ScrollView flex={1}>
        {/* Trading view */}
        <Stack h={300}>
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
          <InformationTabs tokenAddress={tokenAddress} networkId={networkId} />
        </Stack>

        {/* Swap panel and activity overview */}
        <SwapPanel tokenDetail={tokenDetail} networkId={networkId} />

        <TokenActivityOverview tokenDetail={tokenDetail} />
      </ScrollView>
    </>
  );
}
