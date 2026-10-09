// cspell:ignore Financials
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Tabs, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { useStockDetail } from '../../../hooks/StockDetailContext';
import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { StockFinancials } from '../../StockFinancials/StockFinancials';
import { TokenActivityOverview } from '../../TokenActivityOverview/TokenActivityOverview';
import { TokenOverview } from '../../TokenOverview/TokenOverview';
import { useTokenSecurity } from '../../TokenSecurityAlert/hooks';
import { TokenSecurityAlert } from '../../TokenSecurityAlert/TokenSecurityAlert';
import { TokenSupplementaryInfo } from '../../TokenSupplementaryInfo/TokenSupplementaryInfo';
import { TopCoinsOverviewContent } from '../../TopCoinsOverview/TopCoinsOverviewContent';
import { StockMobileOverview } from '../StockMobileOverview';

function OverviewScroll({
  scrollEnabled,
  children,
}: {
  scrollEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <Tabs.ScrollView scrollEnabled={scrollEnabled}>
      {children}
      <Stack h={100} />
    </Tabs.ScrollView>
  );
}

export function MobileTrendingOverviewPanel({
  scrollEnabled,
}: {
  scrollEnabled: boolean;
}) {
  const { networkId } = useTokenDetail();
  const hideActivity = networkUtils.isBTCMainnet(networkId);

  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      {hideActivity ? (
        <TokenOverview />
      ) : (
        <>
          <TokenActivityOverview desktopRedesign summaryLayout="stacked" />
          <TokenSupplementaryInfo variant="overview" columns={2} />
        </>
      )}
    </OverviewScroll>
  );
}

export function MobileTopCoinsOverviewPanel({
  scrollEnabled,
  assetDetail,
  isAssetDetailLoading,
}: {
  scrollEnabled: boolean;
  assetDetail?: IMarketAssetDetailData;
  isAssetDetailLoading?: boolean;
}) {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();
  const { securityData } = useTokenSecurity({ tokenAddress, networkId });
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <TopCoinsOverviewContent
        assetDetail={assetDetail}
        isAssetDetailLoading={isAssetDetailLoading}
        columns={2}
      />
      {networkId && tokenAddress ? (
        <XStack
          testID="market-detail-security-row"
          px="$5"
          pb="$4"
          gap="$1"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_audit })}
          </SizableText>
          {securityData ? (
            <TokenSecurityAlert />
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              --
            </SizableText>
          )}
        </XStack>
      ) : null}
    </OverviewScroll>
  );
}

export function MobileStockOverviewPanel({
  scrollEnabled,
}: {
  scrollEnabled: boolean;
}) {
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <StockMobileOverview />
    </OverviewScroll>
  );
}

export function MobileStockFinancialsPanel({
  scrollEnabled,
}: {
  scrollEnabled: boolean;
}) {
  const { stockId } = useStockDetail();
  if (!stockId) {
    return null;
  }
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <StockFinancials stockId={stockId} />
    </OverviewScroll>
  );
}
