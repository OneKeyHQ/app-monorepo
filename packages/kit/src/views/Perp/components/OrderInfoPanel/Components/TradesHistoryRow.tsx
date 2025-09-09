import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { calcCellAlign } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';

export type ITradesHistoryRowProps = {
  fill: IFill;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
};

const TradesHistoryRow = memo(
  ({ fill, cellMinWidth, columnConfigs, isMobile }: ITradesHistoryRowProps) => {
    const assetSymbol = useMemo(() => fill.coin ?? '-', [fill.coin]);
    const dateInfo = useMemo(() => {
      const timeDate = new Date(fill.time);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const time = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time };
    }, [fill.time]);

    const directionInfo = useMemo(() => {
      const directionStr = fill.dir;
      const side = fill.side;
      let directionColor = '#18794E';
      if (side === 'A') {
        directionColor = '#C62A2F';
      }
      return { directionStr, directionColor };
    }, [fill.dir, fill.side]);

    const tradeBaseInfo = useMemo(() => {
      const price = fill.px;
      const size = fill.sz;
      const fee = fill.fee;
      const priceBN = new BigNumber(price);
      const sizeBN = new BigNumber(size);
      const priceFormatted = numberFormat(price, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
      });
      const feeFormatted = numberFormat(fee, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });

      const tradeValue = priceBN.times(sizeBN).toFixed();
      const tradeValueFormatted = numberFormat(tradeValue, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      return { priceFormatted, size, feeFormatted, tradeValueFormatted };
    }, [fill.fee, fill.px, fill.sz]);

    const closePnlInfo = useMemo(() => {
      const closePnl = fill.closedPnl;
      const closePnlBN = new BigNumber(closePnl);
      let closePnlPlusOrMinus = '';
      let closePnlColor = '#18794E';
      if (closePnlBN.lt(0)) {
        closePnlColor = '#C62A2F';
        closePnlPlusOrMinus = '-';
      }
      const closePnlStr = closePnlBN.abs().toFixed();
      const closePnlFormatted = numberFormat(closePnlStr, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      return { closePnlFormatted, closePnlColor, closePnlPlusOrMinus };
    }, [fill.closedPnl]);

    if (isMobile) {
      return (
        <ListItem
          mx="$5"
          my="$2"
          p="$0"
          backgroundColor="$bgSubdued"
          flexDirection="column"
          alignItems="flex-start"
          borderRadius="$3"
        >
          <XStack
            px="$3"
            pt="$3"
            justifyContent="space-between"
            alignItems="center"
            width="100%"
          >
            <YStack gap="$2">
              <XStack gap="$2">
                <SizableText size="$bodyMdMedium">{assetSymbol}</SizableText>
                <SizableText
                  size="$bodySm"
                  color={directionInfo.directionColor}
                >
                  {directionInfo.directionStr}
                </SizableText>
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                {dateInfo.date} {dateInfo.time}
              </SizableText>
            </YStack>
            <YStack gap="$2" alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                Close PnL
              </SizableText>
              <SizableText size="$bodySm" color={closePnlInfo.closePnlColor}>
                {`${closePnlInfo.closePnlPlusOrMinus}${
                  closePnlInfo.closePnlFormatted as string
                }`}
              </SizableText>
            </YStack>
          </XStack>
          <Divider width="100%" borderColor="$borderSubdued" />
          <XStack
            px="$3"
            pb="$3"
            width="100%"
            flex={1}
            alignItems="center"
            justifyContent="space-around"
          >
            <YStack gap="$1" flex={1} alignItems="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                Price
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.priceFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                Size
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.size}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                Value
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.tradeValueFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                Fee
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.feeFormatted as string}`}
              </SizableText>
            </YStack>
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
        <XStack
          width={columnConfigs[0].width}
          minWidth={columnConfigs[0].minWidth}
          flex={columnConfigs[0].flex}
          justifyContent={calcCellAlign(columnConfigs[0].align)}
          alignItems="center"
        >
          <SizableText size="$bodySmMedium">{assetSymbol}</SizableText>
        </XStack>

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

        {/* Direction */}
        <XStack
          width={columnConfigs[2].width}
          minWidth={columnConfigs[2].minWidth}
          flex={columnConfigs[2].flex}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm" color={directionInfo.directionColor}>
            {directionInfo.directionStr}
          </SizableText>
        </XStack>

        {/* Price */}
        <XStack
          width={columnConfigs[3].width}
          minWidth={columnConfigs[3].minWidth}
          flex={columnConfigs[3].flex}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">{`${
            tradeBaseInfo.priceFormatted as string
          }`}</SizableText>
        </XStack>

        {/* Position size */}
        <XStack
          width={columnConfigs[4].width}
          minWidth={columnConfigs[4].minWidth}
          flex={columnConfigs[4].flex}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${tradeBaseInfo.size}${assetSymbol}`}</SizableText>
        </XStack>

        {/* Trade value */}
        <XStack
          width={columnConfigs[5].width}
          minWidth={columnConfigs[5].minWidth}
          flex={columnConfigs[5].flex}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">
            {`${tradeBaseInfo.tradeValueFormatted as string}`}
          </SizableText>
        </XStack>

        {/* Fee */}
        <XStack
          width={columnConfigs[6].width}
          minWidth={columnConfigs[6].minWidth}
          flex={columnConfigs[6].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd">
            {`${tradeBaseInfo.feeFormatted as string}`}
          </SizableText>
        </XStack>

        {/* Close PnL */}
        <XStack
          width={columnConfigs[7].width}
          minWidth={columnConfigs[7].minWidth}
          flex={columnConfigs[7].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodyMd" color={closePnlInfo.closePnlColor}>
            {`${closePnlInfo.closePnlPlusOrMinus}${
              closePnlInfo.closePnlFormatted as string
            }`}
          </SizableText>
        </XStack>
      </XStack>
    );
  },
  (_prevProps) => {
    return false;
  },
);

TradesHistoryRow.displayName = 'TradesHistoryRow';
export { TradesHistoryRow };
