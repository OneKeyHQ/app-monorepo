import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';

export type ITradesHistoryRowProps = {
  fill: IFill;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
  index: number;
};

const TradesHistoryRow = memo(
  ({
    fill,
    cellMinWidth,
    columnConfigs,
    isMobile,
    index,
  }: ITradesHistoryRowProps) => {
    const actions = useHyperliquidActions();
    const intl = useIntl();
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
      let directionColor = '$green11';
      if (side === 'A') {
        directionColor = '$red11';
      }
      return { directionStr, directionColor };
    }, [fill.dir, fill.side]);

    const tradeBaseInfo = useMemo(() => {
      const price = fill.px;
      const size = fill.sz;
      const fee = fill.fee;
      const decimals = getValidPriceDecimals(price);
      const priceBN = new BigNumber(price);
      const sizeBN = new BigNumber(size);
      const priceFormatted = priceBN.toFixed(decimals);
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
      const closePnlBN = new BigNumber(closePnl).minus(new BigNumber(fill.fee));
      let closePnlPlusOrMinus = '';
      let closePnlColor = '$green11';
      if (closePnlBN.lt(0)) {
        closePnlColor = '$red11';
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
    }, [fill.closedPnl, fill.fee]);

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
            <YStack gap="$1">
              <XStack
                gap="$2"
                alignItems="center"
                // cursor="pointer"
                // onPress={() =>
                //   actions.current.changeActiveAsset({ coin: assetSymbol })
                // }
              >
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
            <YStack gap="$1" alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_trades_close_pnl,
                })}
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
                {intl.formatMessage({
                  id: ETranslations.perp_trades_history_price,
                })}
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.priceFormatted}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_position_size,
                })}
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.size}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_trades_history_trade_value,
                })}
              </SizableText>
              <SizableText size="$bodySm">
                {`${tradeBaseInfo.tradeValueFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_trades_history_fee,
                })}
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
        <XStack
          {...getColumnStyle(columnConfigs[1])}
          justifyContent={calcCellAlign(columnConfigs[1].align)}
          alignItems="center"
          cursor="pointer"
          onPress={() =>
            actions.current.changeActiveAsset({ coin: assetSymbol })
          }
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySmMedium"
          >
            {assetSymbol}
          </SizableText>
        </XStack>

        {/* Direction */}
        <XStack
          {...getColumnStyle(columnConfigs[2])}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={directionInfo.directionColor}
          >
            {directionInfo.directionStr}
          </SizableText>
        </XStack>

        {/* Price */}
        <XStack
          {...getColumnStyle(columnConfigs[3])}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${tradeBaseInfo.priceFormatted}`}</SizableText>
        </XStack>

        {/* Position size */}
        <XStack
          {...getColumnStyle(columnConfigs[4])}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${tradeBaseInfo.size} ${assetSymbol}`}</SizableText>
        </XStack>

        {/* Trade value */}
        <XStack
          {...getColumnStyle(columnConfigs[5])}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {`${tradeBaseInfo.tradeValueFormatted as string}`}
          </SizableText>
        </XStack>

        {/* Fee */}
        <XStack
          {...getColumnStyle(columnConfigs[6])}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {`${tradeBaseInfo.feeFormatted as string}`}
          </SizableText>
        </XStack>

        {/* Close PnL */}
        <XStack
          {...getColumnStyle(columnConfigs[7])}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={closePnlInfo.closePnlColor}
          >
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
