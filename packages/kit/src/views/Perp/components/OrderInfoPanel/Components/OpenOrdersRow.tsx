import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
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
}

const OpenOrdersRow = memo(
  ({
    order,
    cellMinWidth,
    handleCancelAll,
    columnConfigs,
  }: IOpenOrdersRowProps) => {
    const assetInfo = useMemo(() => {
      const assetSymbol = order.coin ?? '-';
      const orderType = order.orderType;
      const type = order.side === 'B' ? 'Buy' : 'Sell';
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
      const value = priceBN.times(sizeBN).toFixed();
      const origSize = order.origSz;
      const triggerCondition = order.triggerCondition;
      return { price, size, value, origSize, triggerCondition, executePrice };
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
            tpPrice = `$${
              numberFormat(child.triggerPx, {
                formatter: 'price',
              }) as string
            }`;
          } else if (child.orderType.startsWith('Stop')) {
            slPrice = `$${
              numberFormat(child.triggerPx, {
                formatter: 'price',
              }) as string
            }`;
          }
        });
      }
      return {
        tpsl: `${tpPrice}/${slPrice}`,
      };
    }, [order.children]);

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
          <SizableText size="$bodySm">{`${orderBaseInfo.size}${assetInfo.assetSymbol}`}</SizableText>
        </XStack>

        {/* Original size */}
        <XStack
          width={columnConfigs[4].width}
          minWidth={columnConfigs[4].minWidth}
          flex={columnConfigs[4].flex}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">{`${orderBaseInfo.origSize}${assetInfo.assetSymbol}`}</SizableText>
        </XStack>

        {/* value */}
        <XStack
          width={columnConfigs[5].width}
          minWidth={columnConfigs[5].minWidth}
          flex={columnConfigs[5].flex}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`$${orderBaseInfo.value}`}</SizableText>
        </XStack>

        {/* Execute price */}
        <XStack
          width={columnConfigs[6].width}
          minWidth={columnConfigs[6].minWidth}
          flex={columnConfigs[6].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">{orderBaseInfo.executePrice}</SizableText>
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
