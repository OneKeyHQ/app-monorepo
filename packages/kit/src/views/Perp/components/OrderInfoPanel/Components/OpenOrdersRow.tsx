import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { FrontendOrder } from '@nktkas/hyperliquid';

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
    const assetInfo = useMemo(() => {
      const assetSymbol = order.coin ?? '-';
      const orderType = order.orderType;
      const type = order.side === 'B' ? 'Long' : 'Short';
      const typeColor = order.side === 'B' ? '$textSuccess' : '$textCritical';
      return { assetSymbol, type, orderType, typeColor };
    }, [order.coin, order.side, order.orderType]);
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
      const sizeBN = new BigNumber(size);
      const executePrice = order.triggerPx;
      const origSize = order.origSz;
      const triggerCondition = order.triggerCondition;
      const origSizeFormatted = numberFormat(origSize, {
        formatter: 'balance',
      });
      const executePriceFormatted = numberFormat(executePrice, {
        formatter: 'price',
      });
      const priceFormatted = numberFormat(price, {
        formatter: 'price',
      });
      const sizeFormatted = numberFormat(size, {
        formatter: 'balance',
      });
      const value = priceBN.times(sizeBN).toFixed();
      const valueFormatted = numberFormat(value, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      return {
        triggerCondition,
        origSizeFormatted,
        executePriceFormatted,
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
            tpPrice = `${
              numberFormat(child.triggerPx, {
                formatter: 'price',
                formatterOptions: {
                  currency: '$',
                },
              }) as string
            }`;
          } else if (child.orderType.startsWith('Stop')) {
            slPrice = `${
              numberFormat(child.triggerPx, {
                formatter: 'price',
                formatterOptions: {
                  currency: '$',
                },
              }) as string
            }`;
          }
        });
      }
      return {
        tpsl: `${tpPrice}/${slPrice}`,
      };
    }, [order.children]);

    if (isMobile) {
      return (
        <ListItem flexDirection="column" alignItems="flex-start">
          <XStack
            justifyContent="space-between"
            width="100%"
            alignItems="center"
          >
            <YStack gap="$2">
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
              <SizableText size="$bodyMd">Cancel</SizableText>
            </Button>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">Filled / Size</SizableText>
            <SizableText size="$bodySm">
              {`${orderBaseInfo.sizeFormatted as string} / ${
                orderBaseInfo.origSizeFormatted as string
              }`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">Price</SizableText>
            <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
              {`${orderBaseInfo.priceFormatted as string}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">Trigger Condition</SizableText>
            <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
              {`${orderBaseInfo.triggerCondition}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">TP/SL</SizableText>
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
        >
          <SizableText size="$bodySm" numberOfLines={1} ellipsizeMode="tail">
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
          >{`${orderBaseInfo.sizeFormatted as string} ${
            assetInfo.assetSymbol
          }`}</SizableText>
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
          >{`${orderBaseInfo.origSizeFormatted as string} ${
            assetInfo.assetSymbol
          }`}</SizableText>
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
          >{`${orderBaseInfo.valueFormatted as string}`}</SizableText>
        </XStack>

        {/* Execute price */}
        <XStack
          {...getColumnStyle(columnConfigs[6])}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {orderBaseInfo.executePriceFormatted as string}
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
          <Button size="small" variant="tertiary" onPress={handleCancelOrder}>
            <SizableText size="$bodyMdMedium" color="$green11">
              Cancel
            </SizableText>
          </Button>
        </XStack>
      </XStack>
    );
  },
);

OpenOrdersRow.displayName = 'OpenOrdersRow';
export { OpenOrdersRow };
