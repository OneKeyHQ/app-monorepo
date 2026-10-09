import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  InteractiveIcon,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openBlockExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useBtcMetadataContext } from '../../hooks/BtcMetadataContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
  formatBlockHeightValue,
  formatMarketCapValue,
  formatStatValueWithFormatter,
} from '../../utils/statValue';
import { useTokenDetailHeaderLeftActions } from '../TokenDetailHeader/hooks/useTokenDetailHeaderLeftActions';
import { TokenSecurityAlert } from '../TokenSecurityAlert';
import { useTokenSecurity } from '../TokenSecurityAlert/hooks/useTokenSecurity';

interface ISupplementaryRow {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
  onPress?: () => void;
}

function TokenOverviewLinks() {
  const intl = useIntl();
  const { tokenDetail, tokenAddress, networkId } = useTokenDetail();
  const { securityData } = useTokenSecurity({ tokenAddress, networkId });
  const { handleOpenWebsite, handleOpenTwitter, handleOpenXSearch } =
    useTokenDetailHeaderLeftActions({ tokenDetail });
  const website = tokenDetail?.extraData?.website;
  const twitter = tokenDetail?.extraData?.twitter;
  const address = tokenDetail?.address;

  if (!securityData && !website && !twitter && !address) {
    return null;
  }

  return (
    <XStack testID="token-mobile-overview-links" ai="center" gap="$3" pt="$2">
      {securityData ? (
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_audit })}
          </SizableText>
          <TokenSecurityAlert />
        </XStack>
      ) : null}
      {website ? (
        <InteractiveIcon
          testID="token-mobile-overview-website"
          icon="GlobusOutline"
          onPress={handleOpenWebsite}
          size="$4"
        />
      ) : null}
      {twitter ? (
        <InteractiveIcon
          testID="token-mobile-overview-twitter"
          icon="Xbrand"
          onPress={handleOpenTwitter}
          size="$4"
        />
      ) : null}
      {address ? (
        <InteractiveIcon
          testID="token-mobile-overview-search"
          icon="SearchOutline"
          onPress={handleOpenXSearch}
          size="$4"
        />
      ) : null}
    </XStack>
  );
}

export function TokenSupplementaryInfo({
  variant = 'sidebar',
  px,
  columns,
}: {
  variant?: 'sidebar' | 'overview';
  px?: ComponentProps<typeof XStack>['px'];
  // Mobile overview is two columns and adds the contract address plus links.
  columns?: 2;
}) {
  const intl = useIntl();
  const { tokenDetail, networkId } = useTokenDetail();
  const btcMetadata = useBtcMetadataContext();
  const { handleCopyAddress } = useTokenDetailHeaderLeftActions({
    tokenDetail,
  });
  const isMobileOverview = columns === 2;

  const handleBlockHeightPress = useCallback(() => {
    if (!btcMetadata) {
      return;
    }
    void openBlockExplorerUrl({
      networkId,
      blockHeight: btcMetadata.blockHeight,
    });
  }, [btcMetadata, networkId]);

  const rows = useMemo<ISupplementaryRow[]>(() => {
    if (btcMetadata) {
      return [
        {
          key: 'totalSupply',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_total_supply,
          }),
          value: formatMarketCapValue(btcMetadata.totalSupply),
        },
        {
          key: 'remainingSupply',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_remaining_supply,
          }),
          value: formatMarketCapValue(btcMetadata.remainingSupply),
        },
        {
          key: 'blockHeight',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_block_height,
          }),
          value: formatBlockHeightValue(btcMetadata.blockHeight),
          onPress: handleBlockHeightPress,
        },
        {
          key: 'blockReward',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_block_reward,
          }),
          value: `${btcMetadata.blockReward} BTC`,
        },
        {
          key: 'nextHalving',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_next_halving,
          }),
          value: btcMetadata.nextHalvingDisplay,
        },
      ];
    }

    if (!tokenDetail) {
      return [];
    }

    if (variant === 'overview') {
      const overviewRows: ISupplementaryRow[] = [
        {
          key: 'marketCap',
          label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
          value: formatStatValueWithFormatter(
            tokenDetail.marketCap,
            USD_CURRENCY_FORMATTER,
          ),
          tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
        },
        {
          key: 'liquidity',
          label: intl.formatMessage({ id: ETranslations.global_liquidity }),
          value: formatStatValueWithFormatter(
            isMobileOverview
              ? tokenDetail.liquidity || tokenDetail.tvl
              : tokenDetail.liquidity,
            USD_CURRENCY_FORMATTER,
          ),
        },
        {
          key: 'holders',
          label: intl.formatMessage({ id: ETranslations.dexmarket_holders }),
          value: formatStatValueWithFormatter(
            tokenDetail.holders,
            MARKET_CAP_FORMATTER,
          ),
        },
        {
          key: 'volume24h',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          }),
          value: formatStatValueWithFormatter(
            tokenDetail.volume24h,
            USD_CURRENCY_FORMATTER,
          ),
        },
        {
          key: 'fdv',
          label: intl.formatMessage({ id: ETranslations.global_fdv }),
          value: formatStatValueWithFormatter(
            tokenDetail.fdv,
            USD_CURRENCY_FORMATTER,
          ),
          tooltip: intl.formatMessage({ id: ETranslations.dexmarket_fdv_desc }),
        },
      ];
      if (isMobileOverview && tokenDetail.address) {
        overviewRows.push({
          key: 'contractAddress',
          label: intl.formatMessage({
            id: ETranslations.global_contract_address,
          }),
          value: accountUtils.shortenAddress({
            address: tokenDetail.address,
            leadingLength: 6,
            trailingLength: 4,
          }),
          onPress: handleCopyAddress,
        });
      }
      return overviewRows;
    }

    return [
      {
        key: 'circulating',
        label: intl.formatMessage({
          id: ETranslations.global_circulating_supply,
        }),
        value: formatStatValueWithFormatter(
          tokenDetail.circulatingSupply,
          MARKET_CAP_FORMATTER,
        ),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_circulating_supply_tips,
        }),
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        value: formatStatValueWithFormatter(
          tokenDetail.marketCap,
          USD_CURRENCY_FORMATTER,
        ),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
      },
      {
        key: 'fdv',
        label: intl.formatMessage({ id: ETranslations.global_fdv }),
        value: formatStatValueWithFormatter(
          tokenDetail.fdv,
          USD_CURRENCY_FORMATTER,
        ),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_fdv_desc }),
      },
    ];
  }, [
    btcMetadata,
    handleBlockHeightPress,
    handleCopyAddress,
    intl,
    isMobileOverview,
    tokenDetail,
    variant,
  ]);

  if (!tokenDetail) {
    return null;
  }

  if (variant === 'overview') {
    return (
      <YStack width="100%" px={px ?? '$5'} py="$6" gap="$5">
        <XStack width="100%" flexWrap="wrap" rowGap="$6">
          {rows.map((item) => (
            <YStack
              key={item.key}
              flex={isMobileOverview ? undefined : 1}
              width={isMobileOverview ? '50%' : undefined}
              minWidth={isMobileOverview ? 0 : 144}
              pr="$2.5"
              gap="$1"
            >
              {item.tooltip ? (
                <Tooltip
                  placement="top"
                  renderTrigger={
                    <DashText
                      size="$bodyMd"
                      color="$textSubdued"
                      dashThickness={0.5}
                      cursor="help"
                      numberOfLines={1}
                    >
                      {item.label}
                    </DashText>
                  }
                  renderContent={
                    <SizableText size="$bodySm">{item.tooltip}</SizableText>
                  }
                />
              ) : (
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {item.label}
                </SizableText>
              )}
              {isMobileOverview ? (
                <XStack ai="center" gap="$1">
                  <SizableText
                    size="$headingMd"
                    numberOfLines={1}
                    onPress={item.onPress}
                    color={item.onPress ? '$textInfo' : undefined}
                  >
                    {item.value}
                  </SizableText>
                  {item.key === 'contractAddress' && item.onPress ? (
                    <InteractiveIcon
                      testID="token-mobile-overview-copy-address"
                      icon="Copy3Outline"
                      size="$4"
                      onPress={item.onPress}
                    />
                  ) : null}
                </XStack>
              ) : (
                <SizableText size="$headingMd" numberOfLines={1}>
                  {item.value}
                </SizableText>
              )}
            </YStack>
          ))}
        </XStack>
        {isMobileOverview && !btcMetadata ? <TokenOverviewLinks /> : null}
      </YStack>
    );
  }

  return (
    <YStack pl="$3" pr="$5" pt="$3" gap="$2.5">
      {rows.map((item) => (
        <XStack key={item.key} gap="$2" jc="space-between" ai="center">
          {item.tooltip ? (
            <Tooltip
              placement="top"
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  dashThickness={0.5}
                  cursor="help"
                >
                  {item.label}
                </DashText>
              }
              renderContent={
                <SizableText size="$bodySm">{item.tooltip}</SizableText>
              }
            />
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              {item.label}
            </SizableText>
          )}
          <SizableText
            size="$bodySmMedium"
            color={item.onPress ? '$textInfo' : '$text'}
            cursor={item.onPress ? 'pointer' : undefined}
            hoverStyle={
              item.onPress ? { textDecorationLine: 'underline' } : undefined
            }
            onPress={item.onPress}
          >
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
