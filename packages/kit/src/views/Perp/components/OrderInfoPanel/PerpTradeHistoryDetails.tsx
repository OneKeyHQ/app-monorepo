import { Fragment, useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  DashText,
  Icon,
  IconButton,
  Page,
  Popover,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useSpotPairDisplayMapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { useShareTradeHistory } from '../../hooks/useShareTradeHistory';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import {
  canShareTradeFill,
  getTradeFillClosePnlBN,
  getTradeFillDisplayInfo,
  getTradeFillExtraRows,
} from './Components/tradeFillDisplay';
import { getFillDirectionDisplayInfo } from './utils';

import type { RouteProp } from '@react-navigation/native';

function TradeHistoryDetails() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const [switchingAsset, setSwitchingAsset] = useState(false);
  const { copyText } = useClipboard();
  const {
    params: { fill, builderFeeRate },
  } =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.PerpTradeHistoryDetails>
    >();
  const [spotDisplayMap] = useSpotPairDisplayMapAtom();
  const shareTrade = useShareTradeHistory();
  const assetSymbol = isSpotInstrument(fill.coin)
    ? spotDisplayMap[fill.coin] ||
      getSpotTokenDisplayName(fill.coin.split('/')[0])
    : parseDexCoin(fill.coin).displayName;
  const isSpot = isSpotInstrument(fill.coin);
  const { result: pair } = usePromiseResult(async () => {
    if (isSpot) {
      const { universes } =
        await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
      const universe = universes.find((item) => item.name === fill.coin);
      return {
        coin: fill.coin,
        name: universe
          ? formatSpotPairDisplayName(universe.baseName, universe.quoteName)
          : fill.coin,
      };
    }
    const tokens =
      await backgroundApiProxy.serviceHyperliquid.getFundingHistoryPaymentTokens(
        { coins: [fill.coin] },
      );
    const quote = tokens[fill.coin];
    return {
      coin: fill.coin,
      name: quote ? `${assetSymbol}/${quote}` : assetSymbol,
    };
  }, [assetSymbol, fill.coin, isSpot]);
  const pairName = pair?.coin === fill.coin ? pair.name : assetSymbol;
  const direction = getFillDirectionDisplayInfo({ fill, intl });
  const directionText = fill.liquidation
    ? `${intl.formatMessage({
        id:
          fill.liquidation.method === 'backstop'
            ? ETranslations.perp_backstop_liquidation__title
            : ETranslations.perp_market_liquidation__title,
      })}: ${direction.text}`
    : direction.text;
  const info = getTradeFillDisplayInfo(fill);
  const extraRows = getTradeFillExtraRows({ fill, assetSymbol, intl }).filter(
    ({ label }) =>
      label !== ETranslations.perp_trade_details_fee_token__title &&
      label !== ETranslations.perps_fee_tiers_builder_fee,
  );
  const pnl = getTradeFillClosePnlBN(fill);
  const pnlText = `${pnl.lt(0) ? '-' : ''}${numberFormat(pnl.abs().toFixed(), {
    formatter: 'value',
    formatterOptions: { currency: '$' },
  })}`;
  const feeTitle = intl.formatMessage({
    id: ETranslations.perp_fee__title,
  });
  const headerRight = useCallback(
    () =>
      canShareTradeFill(fill) ? (
        <IconButton
          variant="tertiary"
          icon="ShareOutline"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.explore_share,
          })}
          onPress={() => shareTrade(fill)}
          testID="perps-trade-history-share"
        />
      ) : null,
    [fill, intl, shareTrade],
  );
  const handleGoToTrade = useCallback(async () => {
    setSwitchingAsset(true);
    try {
      const subscriptionRecoveryProof =
        await actions.current.captureInstrumentSwitchSubscriptionProof({
          source: 'route-focused',
        });
      navigation.popStack();
      await actions.current.switchTradeInstrument({
        mode: isSpotInstrument(fill.coin) ? 'spot' : 'perp',
        coin: fill.coin,
        subscriptionRecoveryProof,
      });
    } finally {
      setSwitchingAsset(false);
    }
  }, [actions, fill.coin, navigation]);
  const rows = [
    {
      label: ETranslations.perp_open_orders_time,
      value: formatTime(new Date(fill.time), {
        formatTemplate: 'yyyy-LL-dd HH:mm:ss',
      }),
    },
    {
      label: ETranslations.perp_trades_history_price,
      value: info.priceFormatted,
    },
    {
      label: ETranslations.perp_executed_size__title,
      value: `${info.sizeFormatted} ${assetSymbol}`,
    },
    {
      label: ETranslations.perp_trades_history_trade_value,
      value: info.tradeValueFormatted,
    },
  ];

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.Limit_order_history_title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <ScrollView contentContainerStyle={{ padding: '$5', gap: '$4' }}>
          <XStack
            mb="$2"
            gap="$4"
            alignItems="center"
            justifyContent="space-between"
            testID="perps-trade-history-details"
          >
            <XStack gap="$2" alignItems="center" flex={1} minWidth={0}>
              <Token
                size="sm"
                borderRadius="$full"
                {...(isSpotInstrument(fill.coin)
                  ? {
                      tokenImageUri: getHyperliquidTokenImageUrl(assetSymbol),
                    }
                  : {
                      tokenImageUris: getHyperliquidTokenImageUris(fill.coin),
                    })}
                fallbackIcon="CryptoCoinOutline"
              />
              <SizableText size="$headingLg" flexShrink={1} numberOfLines={1}>
                {pairName.replace('/', '')}
              </SizableText>
              <Badge
                flexShrink={1}
                badgeSize="sm"
                badgeType="default"
                px="$1"
                py={0}
              >
                <Badge.Text numberOfLines={1} fontSize={10} lineHeight={16}>
                  {intl.formatMessage({
                    id: isSpot
                      ? ETranslations.dexmarket_spot
                      : ETranslations.perp_label_perp,
                  })}
                </Badge.Text>
              </Badge>
            </XStack>
            <Button
              variant="tertiary"
              flexShrink={0}
              size="small"
              childrenAsText={false}
              loading={switchingAsset}
              onPress={handleGoToTrade}
              testID="perps-trade-detail-go-to-trade"
            >
              <XStack alignItems="center" gap="$0.5">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_web_landing_step3_perps_cta,
                  })}
                </SizableText>
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              </XStack>
            </Button>
          </XStack>
          <YStack
            py="$2"
            overflow="hidden"
            bg="$bgSubdued"
            borderRadius="$6"
            borderCurve="continuous"
          >
            <ListItem
              mx="$0"
              px="$4"
              py="$2"
              minHeight="$11"
              borderRadius="$0"
              gap="$4"
            >
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                {intl.formatMessage({
                  id: ETranslations.perp_trades_close_pnl,
                })}
              </SizableText>
              <SizableText
                size="$bodyMdMedium"
                textAlign="right"
                flex={1}
                color={pnl.lt(0) ? '$red11' : '$green11'}
              >
                {pnlText}
              </SizableText>
            </ListItem>
            {rows.map(({ label, value }) => (
              <ListItem
                key={label}
                mx="$0"
                px="$4"
                py="$2"
                minHeight="$11"
                borderRadius="$0"
                gap="$4"
              >
                <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                  {intl.formatMessage({ id: label })}
                </SizableText>
                <SizableText size="$bodyMdMedium" textAlign="right" flex={1}>
                  {value}
                </SizableText>
              </ListItem>
            ))}
          </YStack>
          <YStack
            py="$2"
            overflow="hidden"
            bg="$bgSubdued"
            borderRadius="$6"
            borderCurve="continuous"
          >
            {extraRows.map(({ label, value, copyValue }) => {
              const displayValue =
                label === ETranslations.perp_trades_history_direction
                  ? directionText
                  : value;
              const isTransactionHash =
                label === ETranslations.swap_history_detail_transaction_hash;
              return (
                <Fragment key={label}>
                  <ListItem
                    mx="$0"
                    px="$4"
                    py="$2"
                    minHeight="$11"
                    borderRadius="$0"
                    gap="$4"
                    testID={
                      isTransactionHash
                        ? 'perps-trade-detail-explorer'
                        : undefined
                    }
                    onPress={
                      isTransactionHash
                        ? () =>
                            openUrlExternal(
                              `https://hypurrscan.io/tx/${encodeURIComponent(
                                value,
                              )}`,
                            )
                        : undefined
                    }
                  >
                    <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                      {intl.formatMessage({ id: label })}
                    </SizableText>
                    <XStack
                      flex={1}
                      minWidth={0}
                      gap="$1"
                      alignItems="center"
                      justifyContent="flex-end"
                    >
                      <SizableText
                        size="$bodyMdMedium"
                        color={
                          label === ETranslations.perp_trades_history_direction
                            ? direction.color
                            : '$text'
                        }
                        textAlign="right"
                        flexShrink={1}
                        numberOfLines={copyValue ? 1 : undefined}
                        ellipsizeMode="middle"
                      >
                        {isTransactionHash
                          ? accountUtils.shortenAddress({
                              address: value,
                              leadingLength: 6,
                              trailingLength: 4,
                            })
                          : displayValue}
                      </SizableText>
                      {isTransactionHash ? (
                        <Icon
                          name="OpenOutline"
                          size="$5"
                          color="$iconSubdued"
                        />
                      ) : null}
                      {!isTransactionHash && copyValue ? (
                        <IconButton
                          testID={`perps-trade-detail-copy-${label}`}
                          icon="Copy3Outline"
                          size="small"
                          variant="tertiary"
                          flexShrink={0}
                          accessibilityLabel={`${intl.formatMessage({
                            id: ETranslations.global_copy,
                          })} ${intl.formatMessage({ id: label })}`}
                          onPress={() => copyText(copyValue)}
                        />
                      ) : null}
                    </XStack>
                  </ListItem>
                  {label ===
                  ETranslations.perp_trade_details_start_position__title ? (
                    <>
                      <ListItem
                        mx="$0"
                        px="$4"
                        py="$2"
                        minHeight="$11"
                        borderRadius="$0"
                        gap="$4"
                      >
                        <SizableText
                          size="$bodyMd"
                          color="$textSubdued"
                          flex={1}
                        >
                          {feeTitle}
                        </SizableText>
                        <Popover
                          title={feeTitle}
                          placement="top"
                          renderTrigger={
                            <DashText size="$bodyMdMedium" dashThickness={0.3}>
                              {info.feeFormatted}
                            </DashText>
                          }
                          renderContent={() => (
                            <YStack px="$5" pb="$4" gap="$3">
                              <YStack gap="$1.5">
                                <SizableText size="$bodyMd">
                                  {intl.formatMessage({
                                    id: ETranslations.perps_fee_title,
                                  })}
                                  {builderFeeRate === undefined
                                    ? '-'
                                    : `${(builderFeeRate / 1000).toFixed(2)}%`}
                                </SizableText>
                                <SizableText size="$bodyMd">
                                  {intl.formatMessage({
                                    id: ETranslations.perps_fee_total,
                                  })}
                                  {info.feeFormatted}
                                </SizableText>
                              </YStack>
                              <SizableText size="$bodyMd" color="$textSubdued">
                                {intl.formatMessage({
                                  id: ETranslations.perps_fee_desc,
                                })}
                              </SizableText>
                            </YStack>
                          )}
                        />
                      </ListItem>
                      <ListItem
                        mx="$0"
                        px="$4"
                        py="$2"
                        minHeight="$11"
                        borderRadius="$0"
                        gap="$4"
                      >
                        <SizableText
                          size="$bodyMd"
                          color="$textSubdued"
                          flex={1}
                        >
                          {intl.formatMessage({
                            id: ETranslations.perp_trade_details_fee_token__title,
                          })}
                        </SizableText>
                        <SizableText
                          size="$bodyMdMedium"
                          textAlign="right"
                          flex={1}
                        >
                          {fill.feeToken}
                        </SizableText>
                      </ListItem>
                    </>
                  ) : null}
                </Fragment>
              );
            })}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default function PerpTradeHistoryDetails() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <TradeHistoryDetails />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
