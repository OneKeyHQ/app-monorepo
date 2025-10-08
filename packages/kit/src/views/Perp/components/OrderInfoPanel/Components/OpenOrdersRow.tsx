import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { FrontendOrder } from '@nktkas/hyperliquid';

const balanceFormatter: INumberFormatProps = {
  formatter: 'balance',
};

const balanceCurrencyFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

const priceFormatter: INumberFormatProps = {
  formatter: 'price',
  formatterOptions: {
    currency: '$',
  },
};

interface IOpenOrdersRowProps {
  order: FrontendOrder;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  handleCancelOrder: () => void;
  isMobile?: boolean;
  index: number;
}

const OpenOrdersRow = memo(
  ({
    order,
    cellMinWidth,
    handleCancelOrder,
    columnConfigs,
    isMobile,
    index,
  }: IOpenOrdersRowProps) => {
    const actions = useHyperliquidActions();
    const intl = useIntl();
    const assetInfo = useMemo(() => {
      const assetSymbol = order.coin ?? '-';
      const orderType = (() => {
        switch (order.orderType) {
          case 'Market':
            return intl.formatMessage({
              id: ETranslations.perp_position_market,
            });
          case 'Limit':
            return intl.formatMessage({
              id: ETranslations.perp_position_limit,
            });
          case 'Stop Market':
            return intl.formatMessage({
              id: ETranslations.perp_order_stop_market,
            });
          case 'Stop Limit':
            return intl.formatMessage({
              id: ETranslations.perp_order_stop_limit,
            });
          case 'Take Profit Market':
            return intl.formatMessage({
              id: ETranslations.perp_order_tp_market,
            });
          case 'Take Profit Limit':
            return intl.formatMessage({
              id: ETranslations.perp_order_tp_limit,
            });
          default:
            return order.orderType;
        }
      })();
      const type =
        order.side === 'B'
          ? intl.formatMessage({
              id: ETranslations.perp_long,
            })
          : intl.formatMessage({
              id: ETranslations.perp_short,
            });
      const typeColor = order.side === 'B' ? '$green11' : '$red11';
      return { assetSymbol, type, orderType, typeColor };
    }, [order.coin, order.side, order.orderType, intl]);
    const dateInfo = useMemo(() => {
      const timeDate = new Date(order.timestamp);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const time = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time };
    }, [order.timestamp]);
    const orderBaseInfo = useMemo(() => {
      const price = order.limitPx;
      const size = order.sz;
      const priceBN = new BigNumber(price);
      const executePrice = order.triggerPx;
      const executePriceLimit = order.limitPx;
      const origSize = order.origSz;
      const decimals = getValidPriceDecimals(price);
      const triggerCondition = order.triggerCondition;
      const origSizeBN = new BigNumber(origSize);
      const origSizeFormatted = numberFormat(origSize, balanceFormatter);
      const executePriceFormatted = new BigNumber(executePrice).toFixed(
        decimals,
      );
      const executePriceLimitFormatted = new BigNumber(
        executePriceLimit,
      ).toFixed(decimals);
      const priceFormatted = new BigNumber(price).toFixed(decimals);
      const sizeFormatted = numberFormat(size, balanceFormatter);
      const value = priceBN.times(origSizeBN).toFixed();
      const valueFormatted = numberFormat(value, balanceCurrencyFormatter);
      return {
        triggerCondition,
        origSizeFormatted,
        executePriceFormatted,
        executePriceLimitFormatted,
        priceFormatted,
        sizeFormatted,
        valueFormatted,
      };
    }, [
      order.limitPx,
      order.sz,
      order.origSz,
      order.triggerCondition,
      order.triggerPx,
    ]);

    const tpslInfo = useMemo(() => {
      const tpslChildren = order.children;
      let tpPrice = '--';
      let slPrice = '--';
      if (tpslChildren && tpslChildren.length > 0) {
        const tpslOrders = tpslChildren.filter((child) => child.isPositionTpsl);
        tpslOrders.forEach((child) => {
          if (child.orderType.startsWith('Take')) {
            tpPrice = `${numberFormat(child.triggerPx, priceFormatter)}`;
          } else if (child.orderType.startsWith('Stop')) {
            slPrice = `${numberFormat(child.triggerPx, priceFormatter)}`;
          }
        });
      }
      return {
        tpsl: `${tpPrice}/${slPrice}`,
      };
    }, [order.children]);

    if (isMobile) {
      return (
        <ListItem
          flex={1}
          mt="$1.5"
          flexDirection="column"
          alignItems="flex-start"
        >
          <XStack
            justifyContent="space-between"
            width="100%"
            alignItems="center"
          >
            <YStack
              cursor="pointer"
              onPress={() =>
                actions.current.changeActiveAsset({
                  coin: assetInfo.assetSymbol,
                })
              }
            >
              <SizableText
                numberOfLines={1}
                ellipsizeMode="tail"
                size="$bodyMdMedium"
              >
                {assetInfo.assetSymbol}
              </SizableText>
              <XStack gap="$2">
                <SizableText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  size="$bodySm"
                  color={assetInfo.typeColor}
                >
                  {`${assetInfo.orderType} / ${assetInfo.type}`}
                </SizableText>
                <SizableText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  size="$bodySm"
                  color="$textSubdued"
                >
                  {`${dateInfo.date} ${dateInfo.time}`}
                </SizableText>
              </XStack>
            </YStack>
            <Button
              size="small"
              variant="secondary"
              onPress={handleCancelOrder}
            >
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_open_orders_cancel,
                })}
              </SizableText>
            </Button>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_position_mobile_fill,
              })}
            </SizableText>
            <SizableText size="$bodySm">
              {`${orderBaseInfo.sizeFormatted} / ${orderBaseInfo.origSizeFormatted}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_orderbook_price,
              })}
            </SizableText>
            <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
              {`${orderBaseInfo.priceFormatted}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_open_orders_trigger_condition,
              })}
            </SizableText>
            <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
              {`${orderBaseInfo.triggerCondition}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_position_tp_sl,
              })}
            </SizableText>
            <SizableText
              numberOfLines={1}
              ellipsizeMode="tail"
              size="$bodySm"
            >{`${tpslInfo.tpsl}`}</SizableText>
          </XStack>
        </ListItem>
      );
    }

    return (
      <XStack
        flex={1}
        py="$1.5"
        px="$3"
        alignItems="center"
        hoverStyle={{ bg: '$bgHover' }}
        minWidth={cellMinWidth}
        {...(index % 2 === 1 && {
          backgroundColor: '$bgSubdued',
        })}
      >
        {/* Time */}
        <YStack
          {...getColumnStyle(columnConfigs[0])}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[0].align)}
          pl="$2"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {dateInfo.date}
          </SizableText>
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color="$textSubdued"
          >
            {dateInfo.time}
          </SizableText>
        </YStack>
        {/* Asset symbol */}
        <YStack
          {...getColumnStyle(columnConfigs[1])}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[1].align)}
          cursor="pointer"
          onPress={() =>
            actions.current.changeActiveAsset({
              coin: assetInfo.assetSymbol,
            })
          }
        >
          <SizableText
            size="$bodySm"
            fontWeight={600}
            numberOfLines={1}
            color={assetInfo.typeColor}
            ellipsizeMode="tail"
          >
            {assetInfo.assetSymbol}
          </SizableText>
          <SizableText
            size="$bodySm"
            color={assetInfo.typeColor}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {assetInfo.type}
          </SizableText>
        </YStack>

        {/* Type */}
        <XStack
          {...getColumnStyle(columnConfigs[2])}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {assetInfo.orderType}
          </SizableText>
        </XStack>

        {/*  size */}
        <XStack
          {...getColumnStyle(columnConfigs[3])}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${orderBaseInfo.sizeFormatted}`}</SizableText>
        </XStack>

        {/* Original size */}
        <XStack
          {...getColumnStyle(columnConfigs[4])}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${orderBaseInfo.origSizeFormatted}`}</SizableText>
        </XStack>

        {/* value */}
        <XStack
          {...getColumnStyle(columnConfigs[5])}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${orderBaseInfo.valueFormatted}`}</SizableText>
        </XStack>

        {/* Execute price */}
        <XStack
          {...getColumnStyle(columnConfigs[6])}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {order.orderType.includes('Market')
              ? intl.formatMessage({
                  id: ETranslations.perp_position_market,
                })
              : orderBaseInfo.executePriceLimitFormatted}
          </SizableText>
        </XStack>
        {/* Trigger Condition */}
        <XStack
          {...getColumnStyle(columnConfigs[7])}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {orderBaseInfo.triggerCondition}
          </SizableText>
        </XStack>
        {/* TPSL */}
        <XStack
          {...getColumnStyle(columnConfigs[8])}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {tpslInfo.tpsl}
          </SizableText>
        </XStack>

        {/* Cancel All */}
        <XStack
          {...getColumnStyle(columnConfigs[9])}
          justifyContent={calcCellAlign(columnConfigs[9].align)}
          alignItems="center"
        >
          <SizableText
            color="$green11"
            hoverStyle={{ size: '$bodySmMedium', fontWeight: 600 }}
            cursor="pointer"
            size="$bodySm"
            fontWeight={400}
            onPress={handleCancelOrder}
          >
            {intl.formatMessage({
              id: ETranslations.perp_open_orders_cancel,
            })}
          </SizableText>
        </XStack>
      </XStack>
    );
  },
);

OpenOrdersRow.displayName = 'OpenOrdersRow';
export { OpenOrdersRow };
