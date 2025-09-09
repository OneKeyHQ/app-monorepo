import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { calcCellAlign } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IOpenOrdersRowProps {
  order: FrontendOrder;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  handleCancelAll: () => void;
  isMobile?: boolean;
}

const OpenOrdersRow = memo(
  ({
    order,
    cellMinWidth,
    handleCancelAll,
    columnConfigs,
    isMobile,
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
        formatterOptions: {
          currency: '$',
        },
      });
      const priceFormatted = numberFormat(price, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
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
              <SizableText size="$bodyMdMedium">
                {assetInfo.assetSymbol}
              </SizableText>
              <XStack gap="$2">
                <SizableText size="$bodySm" color={assetInfo.typeColor}>
                  {`${assetInfo.orderType} / ${assetInfo.type}`}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {`${dateInfo.date} ${dateInfo.time}`}
                </SizableText>
              </XStack>
            </YStack>
            <Button size="small" variant="secondary" onPress={handleCancelAll}>
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
            <SizableText size="$bodySm">
              {`$${orderBaseInfo.priceFormatted as string}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">Trigger Condition</SizableText>
            <SizableText size="$bodySm">
              {`${orderBaseInfo.triggerCondition}`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText size="$bodySm">TP/SL</SizableText>
            <SizableText size="$bodySm">{`${tpslInfo.tpsl}`}</SizableText>
          </XStack>
        </ListItem>
      );
    }

    return (
      <XStack
        flex={1}
        py="$2"
        px="$3"
        alignItems="center"
        hoverStyle={{ bg: '$bgHover' }}
        bg="$bg"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        minWidth={cellMinWidth}
      >
        {/* Asset symbol */}
        <YStack
          width={columnConfigs[0].width}
          minWidth={columnConfigs[0].minWidth}
          flex={columnConfigs[0].flex}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[0].align)}
        >
          <SizableText size="$bodySm">{assetInfo.assetSymbol}</SizableText>
          <SizableText size="$bodySm" color={assetInfo.typeColor}>
            {assetInfo.type}
          </SizableText>
        </YStack>

        {/* Time */}
        <YStack
          width={columnConfigs[1].width}
          minWidth={columnConfigs[1].minWidth}
          flex={columnConfigs[1].flex}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[1].align)}
        >
          <SizableText size="$bodySm">{dateInfo.date}</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {dateInfo.time}
          </SizableText>
        </YStack>

        {/* Type */}
        <XStack
          width={columnConfigs[2].width}
          minWidth={columnConfigs[2].minWidth}
          flex={columnConfigs[2].flex}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{assetInfo.orderType}</SizableText>
        </XStack>

        {/*  size */}
        <XStack
          width={columnConfigs[3].width}
          minWidth={columnConfigs[3].minWidth}
          flex={columnConfigs[3].flex}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            orderBaseInfo.sizeFormatted as string
          }${assetInfo.assetSymbol}`}</SizableText>
        </XStack>

        {/* Original size */}
        <XStack
          width={columnConfigs[4].width}
          minWidth={columnConfigs[4].minWidth}
          flex={columnConfigs[4].flex}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">{`${
            orderBaseInfo.origSizeFormatted as string
          }${assetInfo.assetSymbol}`}</SizableText>
        </XStack>

        {/* value */}
        <XStack
          width={columnConfigs[5].width}
          minWidth={columnConfigs[5].minWidth}
          flex={columnConfigs[5].flex}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            orderBaseInfo.valueFormatted as string
          }`}</SizableText>
        </XStack>

        {/* Execute price */}
        <XStack
          width={columnConfigs[6].width}
          minWidth={columnConfigs[6].minWidth}
          flex={columnConfigs[6].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">
            {orderBaseInfo.executePriceFormatted as string}
          </SizableText>
        </XStack>
        {/* Trigger Condition */}
        <XStack
          width={columnConfigs[7].width}
          minWidth={columnConfigs[7].minWidth}
          flex={columnConfigs[7].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">
            {orderBaseInfo.triggerCondition}
          </SizableText>
        </XStack>
        {/* TPSL */}
        <XStack
          width={columnConfigs[8].width}
          minWidth={columnConfigs[8].minWidth}
          flex={columnConfigs[8].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">{tpslInfo.tpsl}</SizableText>
        </XStack>

        {/* Cancel All */}
        <XStack
          width={columnConfigs[9].width}
          minWidth={columnConfigs[9].minWidth}
          flex={columnConfigs[9].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <Button size="small" variant="tertiary" onPress={handleCancelAll}>
            <SizableText size="$bodyMd">Cancel</SizableText>
          </Button>
        </XStack>
      </XStack>
    );
  },
);

OpenOrdersRow.displayName = 'OpenOrdersRow';
export { OpenOrdersRow };
