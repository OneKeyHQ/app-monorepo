import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { AssetPosition, FrontendOrder } from '@nktkas/hyperliquid';

interface IPositionRowProps {
  pos: AssetPosition['position'];
  coin: string;
  handleClosePosition: (type: 'market' | 'limit') => void;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  tpslOrders: FrontendOrder[];
  handleViewTpslOrders: () => void;
  setTpsl: () => void;
  isMobile?: boolean;
  index: number;
}

function MarkPrice({ coin, decimals }: { coin: string; decimals: number }) {
  const { midFormattedByDecimals } = usePerpsMidPrice({
    coin,
    szDecimals: decimals,
  });

  return (
    <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
      {midFormattedByDecimals}
    </SizableText>
  );
}

const PositionRow = memo(
  ({
    pos,
    coin,
    tpslOrders,
    cellMinWidth,
    columnConfigs,
    isMobile,
    handleClosePosition,
    handleViewTpslOrders,
    setTpsl,
    index,
  }: IPositionRowProps) => {
    const actions = useHyperliquidActions();
    const intl = useIntl();
    const side = useMemo(() => {
      return parseFloat(pos.szi || '0') >= 0 ? 'long' : 'short';
    }, [pos.szi]);
    const assetInfo = useMemo(() => {
      const leverageType =
        pos.leverage?.type === 'cross'
          ? intl.formatMessage({
              id: ETranslations.perp_trade_cross,
            })
          : intl.formatMessage({
              id: ETranslations.perp_trade_isolated,
            });
      return {
        assetSymbol: pos.coin,
        leverage: pos.leverage?.value ?? '',
        assetColor: side === 'long' ? '$green11' : '$red11',
        leverageType,
      };
    }, [pos.coin, side, pos.leverage?.value, pos.leverage?.type, intl]);
    const decimals = useMemo(
      () => getValidPriceDecimals(pos.entryPx || '0'),
      [pos.entryPx],
    );

    const priceInfo = useMemo(() => {
      const entryPrice = new BigNumber(pos.entryPx || '0').toFixed(decimals);
      const liquidationPrice = new BigNumber(pos.liquidationPx || '0');
      const entryPriceFormatted = entryPrice;
      const liquidationPriceFormatted = liquidationPrice.isZero()
        ? 'N/A'
        : liquidationPrice.toFixed(decimals);
      return {
        entryPriceFormatted,
        liquidationPriceFormatted,
      };
    }, [decimals, pos.entryPx, pos.liquidationPx]);

    const sizeInfo = useMemo(() => {
      const sizeBN = new BigNumber(pos.szi || '0');
      const sizeAbs = sizeBN.abs().toFixed();
      const sizeAbsFormatted = numberFormat(sizeAbs, {
        formatter: 'balance',
      });
      const sizeValue = new BigNumber(pos.positionValue || '0').toFixed();
      const sizeValueFormatted = numberFormat(sizeValue, {
        formatter: 'balance',
        formatterOptions: {
          currency: isMobile ? '' : '$',
        },
      });
      return {
        sizeAbsFormatted,
        sizeValue: sizeValueFormatted,
      };
    }, [pos.szi, pos.positionValue, isMobile]);

    const otherInfo = useMemo(() => {
      const pnlBn = new BigNumber(pos.unrealizedPnl || '0');
      const pnlAbs = pnlBn.abs().toFixed();
      const pnlFormatted = numberFormat(pnlAbs, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      let pnlColor = '$green11';
      let pnlPlusOrMinus = '+';
      if (pnlBn.lt(0)) {
        pnlColor = '$red11';
        pnlPlusOrMinus = '-';
      }
      const marginUsedBN = new BigNumber(pos.marginUsed || '0');
      const marginUsedFormatted = numberFormat(marginUsedBN.toFixed(), {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });

      const fundingAllTimeBN = new BigNumber(pos.cumFunding.allTime);
      const fundingSinceOpenBN = new BigNumber(pos.cumFunding.sinceOpen);
      const fundingSinceChangeBN = new BigNumber(pos.cumFunding.sinceChange);
      const fundingAllPlusOrMinus = fundingAllTimeBN.gt(0) ? '-' : '+';
      const fundingAllTimeColor = fundingAllTimeBN.gt(0)
        ? '$red11'
        : '$green11';
      const fundingSinceOpenPlusOrMinus = fundingSinceOpenBN.gt(0) ? '-' : '+';
      const fundingSinceOpenColor = fundingSinceOpenBN.gt(0)
        ? '$red11'
        : '$green11';
      const fundingSinceChangeColor = fundingSinceChangeBN.gt(0)
        ? '$red11'
        : '$green11';
      const fundingSinceChangePlusOrMinus = fundingSinceChangeBN.gt(0)
        ? '-'
        : '+';
      const fundingAllTimeFormatted = fundingAllTimeBN.abs().toFixed(2);
      const fundingSinceOpenFormatted = fundingSinceOpenBN.abs().toFixed(2);
      const fundingSinceChangeFormatted = fundingSinceChangeBN.abs().toFixed(2);
      const roiPercent = marginUsedBN.gt(0)
        ? pnlBn.div(marginUsedBN).times(100).abs().toFixed(2)
        : '0';
      return {
        unrealizedPnl: pnlFormatted,
        marginUsedFormatted,
        fundingAllTimeFormatted,
        fundingSinceOpenFormatted,
        fundingSinceChangeFormatted,
        fundingAllPlusOrMinus,
        fundingAllTimeColor,
        fundingSinceOpenPlusOrMinus,
        fundingSinceOpenColor,
        fundingSinceChangePlusOrMinus,
        fundingSinceChangeColor,
        roiPercent,
        pnlColor,
        pnlPlusOrMinus,
      };
    }, [pos.unrealizedPnl, pos.marginUsed, pos.cumFunding]);

    const tpslInfo = useMemo(() => {
      let tpPrice = '--';
      let slPrice = '--';
      let showOrder = false;
      if (tpslOrders && tpslOrders.length > 0) {
        showOrder = tpslOrders.every((order) => !order.isPositionTpsl);
        if (!showOrder) {
          tpslOrders.forEach((order) => {
            if (order.orderType.startsWith('Take') && order.isPositionTpsl) {
              tpPrice = `${
                numberFormat(order.triggerPx, {
                  formatter: 'price',
                  formatterOptions: {
                    currency: '$',
                  },
                }) as string
              }`;
            } else if (
              order.orderType.startsWith('Stop') &&
              order.isPositionTpsl
            ) {
              slPrice = `${
                numberFormat(order.triggerPx, {
                  formatter: 'price',
                  formatterOptions: {
                    currency: '$',
                  },
                }) as string
              }`;
            }
          });
        }
      }
      return { tpsl: `${tpPrice}/${slPrice}`, showOrder };
    }, [tpslOrders]);

    const [isSizeViewChange, setIsSizeViewChange] = useState(false);
    const handleSizeViewChange = useCallback(() => {
      setIsSizeViewChange(!isSizeViewChange);
    }, [isSizeViewChange]);

    if (isMobile) {
      return (
        <ListItem
          flex={1}
          mt="$1.5"
          flexDirection="column"
          alignItems="flex-start"
        >
          <XStack
            gap="$2"
            alignItems="center"
            cursor="pointer"
            onPress={() =>
              actions.current.changeActiveAsset({
                coin: assetInfo.assetSymbol,
              })
            }
          >
            <XStack
              w="$4"
              h="$4"
              justifyContent="center"
              alignItems="center"
              borderRadius={2}
              backgroundColor={assetInfo.assetColor}
            >
              <SizableText size="$bodySmMedium" color="$textOnColor">
                {side === 'long'
                  ? intl.formatMessage({
                      id: ETranslations.perp_position_b,
                    })
                  : intl.formatMessage({
                      id: ETranslations.perp_position_s,
                    })}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium" color="$text">
              {assetInfo.assetSymbol}
            </SizableText>
            <SizableText
              bg="$bgSubdued"
              borderRadius={2}
              px="$1"
              color="$textSubdued"
              fontSize={10}
            >
              {assetInfo.leverageType} {assetInfo.leverage}X
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            justifyContent="space-between"
            alignItems="center"
          >
            <YStack gap="$1">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_pnl_mobile,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium" color={otherInfo.pnlColor}>
                {`${otherInfo.pnlPlusOrMinus}${
                  otherInfo.unrealizedPnl as string
                }`}
              </SizableText>
            </YStack>
            <YStack gap="$1" alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                ROE
              </SizableText>
              <SizableText size="$bodyMdMedium" color={otherInfo.pnlColor}>
                {`${otherInfo.pnlPlusOrMinus}${otherInfo.roiPercent}%`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <YStack gap="$1" width={120}>
              <XStack
                alignItems="center"
                gap="$1"
                onPress={handleSizeViewChange}
              >
                <XStack alignItems="center" gap="$0.5">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.perp_position_position_size,
                    })}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {`${
                      isSizeViewChange ? '(USD)' : `(${assetInfo.assetSymbol})`
                    }`}
                  </SizableText>
                </XStack>
                <Icon name="RepeatOutline" size="$3" color="$textSubdued" />
              </XStack>
              <XStack alignItems="center" gap="$1" cursor="pointer">
                <SizableText size="$bodySmMedium">
                  {`${
                    isSizeViewChange
                      ? (sizeInfo.sizeValue as string)
                      : (sizeInfo.sizeAbsFormatted as string)
                  }`}
                </SizableText>
              </XStack>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_margin,
                })}
              </SizableText>
              <SizableText size="$bodySmMedium">
                {`${otherInfo.marginUsedFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" width={120} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_entry_price,
                })}
              </SizableText>
              <SizableText size="$bodySmMedium">
                {`${priceInfo.entryPriceFormatted}`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <YStack gap="$1" width={120}>
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_position_funding_2,
                })}
                renderTrigger={
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    textDecorationLine="underline"
                    textDecorationStyle="dotted"
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_position_funding_2,
                    })}
                  </SizableText>
                }
                renderContent={
                  <YStack
                    bg="$bg"
                    justifyContent="center"
                    w="100%"
                    px="$5"
                    pt="$2"
                    pb="$5"
                    gap="$4"
                  >
                    <XStack alignItems="center" justifyContent="space-between">
                      <YStack w="50%">
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.perp_position_funding_since_open,
                          })}
                        </SizableText>
                        <SizableText
                          size="$bodyMdMedium"
                          color={otherInfo.fundingSinceOpenColor}
                        >
                          {`${otherInfo.fundingSinceOpenPlusOrMinus}$${otherInfo.fundingSinceOpenFormatted}`}
                        </SizableText>
                      </YStack>

                      <YStack w="50%">
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.perp_position_funding_since_change,
                          })}
                        </SizableText>
                        <SizableText
                          size="$bodyMdMedium"
                          color={otherInfo.fundingSinceChangeColor}
                        >
                          {`${otherInfo.fundingSinceChangePlusOrMinus}$${otherInfo.fundingSinceChangeFormatted}`}
                        </SizableText>
                      </YStack>
                    </XStack>
                    <XStack alignItems="center" justifyContent="space-between">
                      <YStack w="50%">
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage(
                            {
                              id: ETranslations.perp_position_funding_all_time,
                            },
                            { token: assetInfo.assetSymbol },
                          )}
                        </SizableText>
                        <SizableText
                          size="$bodyMdMedium"
                          color={otherInfo.fundingAllTimeColor}
                        >
                          {`${otherInfo.fundingAllPlusOrMinus}$${otherInfo.fundingAllTimeFormatted}`}
                        </SizableText>
                      </YStack>
                    </XStack>
                    <Divider />
                    <YStack gap="$2">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip0,
                        })}
                      </SizableText>
                      <SizableText size="$bodySmMedium">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip1,
                        })}
                      </SizableText>
                      <SizableText size="$bodySmMedium">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip2,
                        })}
                      </SizableText>
                    </YStack>
                  </YStack>
                }
              />

              <SizableText
                size="$bodySmMedium"
                color={otherInfo.fundingSinceOpenColor}
              >
                {`${otherInfo.fundingSinceOpenPlusOrMinus}$${otherInfo.fundingSinceOpenFormatted}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_tp_sl,
                })}
              </SizableText>
              <SizableText size="$bodySmMedium">{`${tpslInfo.tpsl}`}</SizableText>
            </YStack>
            <YStack gap="$1" width={120} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_liq_price,
                })}
              </SizableText>
              <SizableText size="$bodySmMedium">
                {`${priceInfo.liquidationPriceFormatted}`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" gap="$2.5" justifyContent="space-between">
            <Button
              size="medium"
              variant="secondary"
              onPress={setTpsl}
              flex={1}
            >
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_trade_set_tp_sl,
                })}
              </SizableText>
            </Button>
            <Button
              size="medium"
              variant="secondary"
              onPress={() => handleClosePosition('market')}
              flex={1}
            >
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_close_position_title,
                })}
              </SizableText>
            </Button>
          </XStack>
        </ListItem>
      );
    }
    return (
      <XStack
        minWidth={cellMinWidth}
        py="$1.5"
        px="$3"
        display="flex"
        flex={1}
        alignItems="center"
        hoverStyle={{ bg: '$bgHover' }}
        {...(index % 2 === 1 && {
          backgroundColor: '$bgSubdued',
        })}
      >
        {/* Symbol & Leverage */}
        <XStack
          {...getColumnStyle(columnConfigs[0])}
          alignItems="center"
          justifyContent={calcCellAlign(columnConfigs[0].align)}
          gap="$2"
          pl="$2"
          cursor="pointer"
          onPress={() =>
            actions.current.changeActiveAsset({
              coin: assetInfo.assetSymbol,
            })
          }
        >
          <XStack alignItems="center" gap="$2">
            <Divider
              vertical
              height={30}
              borderWidth={2}
              borderRadius={2}
              borderColor={assetInfo.assetColor}
            />
            <YStack>
              <SizableText
                numberOfLines={1}
                ellipsizeMode="tail"
                size="$bodySmMedium"
                fontWeight={600}
                color={assetInfo.assetColor}
                hoverStyle={{ fontWeight: 700 }}
                pressStyle={{ fontWeight: 700 }}
              >
                {assetInfo.assetSymbol}
              </SizableText>

              <SizableText
                size="$bodySm"
                lineHeight={20}
                color="$textSubdued"
                fontSize={12}
              >
                {assetInfo.leverageType} {assetInfo.leverage}X
              </SizableText>
            </YStack>
          </XStack>
        </XStack>

        {/* Position Size */}
        <YStack
          {...getColumnStyle(columnConfigs[1])}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[1].align)}
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {`${sizeInfo.sizeAbsFormatted as string}`}
          </SizableText>
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color="$textSubdued"
          >
            {`${sizeInfo.sizeValue as string}`}
          </SizableText>
        </YStack>

        {/* Entry Price */}
        <XStack
          {...getColumnStyle(columnConfigs[2])}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${priceInfo.entryPriceFormatted}`}</SizableText>
        </XStack>

        {/* Mark Price */}
        <XStack
          {...getColumnStyle(columnConfigs[3])}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <MarkPrice coin={coin} decimals={decimals} />
        </XStack>
        {/* Liq. Price */}
        <XStack
          {...getColumnStyle(columnConfigs[4])}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${priceInfo.liquidationPriceFormatted}`}</SizableText>
        </XStack>
        {/* Unrealized PnL */}
        <XStack
          {...getColumnStyle(columnConfigs[5])}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText
            size="$bodySm"
            color={otherInfo.pnlColor}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {`${otherInfo.pnlPlusOrMinus}${otherInfo.unrealizedPnl as string}(${
              otherInfo.pnlPlusOrMinus
            }${otherInfo.roiPercent}%)`}
          </SizableText>
        </XStack>

        {/* Margin */}
        <XStack
          {...getColumnStyle(columnConfigs[6])}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${otherInfo.marginUsedFormatted as string}`}</SizableText>
        </XStack>

        {/* Funding */}
        <XStack
          {...getColumnStyle(columnConfigs[7])}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
        >
          <Tooltip
            renderTrigger={
              <SizableText
                numberOfLines={1}
                ellipsizeMode="tail"
                size="$bodySm"
                color={otherInfo.fundingSinceOpenColor}
              >{`${otherInfo.fundingSinceOpenPlusOrMinus}$${otherInfo.fundingSinceOpenFormatted}`}</SizableText>
            }
            renderContent={
              <YStack gap="$2">
                <XStack>
                  <SizableText size="$bodySm">
                    {intl.formatMessage(
                      {
                        id: ETranslations.perp_position_funding_since_open,
                      },
                      { token: assetInfo.assetSymbol },
                    )}
                    {': '}
                  </SizableText>
                  <SizableText
                    size="$bodySm"
                    color={otherInfo.fundingAllTimeColor}
                  >
                    {`${otherInfo.fundingSinceOpenPlusOrMinus}$${otherInfo.fundingSinceOpenFormatted}`}{' '}
                  </SizableText>
                </XStack>
                <XStack>
                  <SizableText size="$bodySm">
                    {intl.formatMessage(
                      {
                        id: ETranslations.perp_position_funding_all_time,
                      },
                      { token: assetInfo.assetSymbol },
                    )}
                    {': '}
                  </SizableText>
                  <SizableText
                    size="$bodySm"
                    color={otherInfo.fundingAllTimeColor}
                  >
                    {`${otherInfo.fundingAllPlusOrMinus}$${otherInfo.fundingAllTimeFormatted}`}{' '}
                  </SizableText>
                </XStack>
                <XStack>
                  <SizableText size="$bodySm">
                    {intl.formatMessage({
                      id: ETranslations.perp_position_funding_since_change,
                    })}
                    {': '}
                  </SizableText>
                  <SizableText
                    size="$bodySm"
                    color={otherInfo.fundingSinceChangeColor}
                  >
                    {`${otherInfo.fundingSinceChangePlusOrMinus}$${otherInfo.fundingSinceChangeFormatted}`}
                  </SizableText>
                </XStack>
              </YStack>
            }
          />
        </XStack>

        {/* TPSL */}
        <XStack
          {...getColumnStyle(columnConfigs[8])}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
          alignItems="center"
        >
          {tpslInfo.showOrder ? (
            <XStack alignItems="center" gap="$1">
              <IconButton
                variant="tertiary"
                size="small"
                icon="HighlightOutline"
                iconSize="$3"
                onPress={setTpsl}
                cursor="pointer"
              />

              <SizableText
                cursor="pointer"
                hoverStyle={{ size: '$bodySmMedium' }}
                color="$green11"
                size="$bodySm"
                onPress={handleViewTpslOrders}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_position_view_orders,
                })}
              </SizableText>
            </XStack>
          ) : (
            <XStack alignItems="center" gap="$1">
              <IconButton
                variant="tertiary"
                size="small"
                icon="HighlightOutline"
                iconSize="$3"
                onPress={setTpsl}
                cursor="pointer"
              />
              <SizableText
                numberOfLines={1}
                ellipsizeMode="tail"
                size="$bodySm"
              >
                {tpslInfo.tpsl}
              </SizableText>
            </XStack>
          )}
        </XStack>

        {/* Actions */}
        <XStack
          {...getColumnStyle(columnConfigs[9])}
          justifyContent={calcCellAlign(columnConfigs[9].align)}
          alignItems="center"
          gap="$2"
        >
          <XStack
            cursor="pointer"
            onPress={() => handleClosePosition('market')}
          >
            <SizableText
              cursor="pointer"
              hoverStyle={{ size: '$bodySmMedium', fontWeight: 600 }}
              color="$green11"
              size="$bodySm"
              fontWeight={400}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_market,
              })}
            </SizableText>
          </XStack>
          <XStack cursor="pointer" onPress={() => handleClosePosition('limit')}>
            <SizableText
              cursor="pointer"
              hoverStyle={{ size: '$bodySmMedium', fontWeight: 600 }}
              color="$green11"
              size="$bodySm"
              fontWeight={400}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_limit,
              })}
            </SizableText>
          </XStack>
        </XStack>
      </XStack>
    );
  },
  (_prevProps) => {
    return false;
  },
);

PositionRow.displayName = 'PositionRow';
export { PositionRow };
