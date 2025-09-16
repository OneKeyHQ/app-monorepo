import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { AssetPosition, FrontendOrder } from '@nktkas/hyperliquid';

interface IPositionRowProps {
  pos: AssetPosition['position'];
  mid?: string;
  handleClosePosition: (type: 'market' | 'limit') => void;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  tpslOrders: FrontendOrder[];
  handleViewTpslOrders: () => void;
  onAllClose: () => void;
  setTpsl: () => void;
  isMobile?: boolean;
  index: number;
}

const PositionRow = memo(
  ({
    pos,
    mid,
    tpslOrders,
    cellMinWidth,
    columnConfigs,
    isMobile,
    handleClosePosition,
    handleViewTpslOrders,
    onAllClose,
    setTpsl,
    index,
  }: IPositionRowProps) => {
    const side = useMemo(() => {
      return parseFloat(pos.szi || '0') >= 0 ? 'long' : 'short';
    }, [pos.szi]);
    const assetInfo = useMemo(() => {
      return {
        assetSymbol: pos.coin,
        leverage: pos.leverage?.value ?? '',
        assetColor: side === 'long' ? '$textSuccess' : '$textCritical',
      };
    }, [pos.coin, side, pos.leverage?.value]);

    const priceInfo = useMemo(() => {
      const entryPrice = new BigNumber(pos.entryPx || '0').toFixed();
      const markPrice = new BigNumber(mid || '0').toFixed();
      const liquidationPrice = new BigNumber(pos.liquidationPx || '0');
      const entryPriceFormatted = numberFormat(entryPrice, {
        formatter: 'price',
      });
      const markPriceFormatted = numberFormat(markPrice, {
        formatter: 'price',
      });
      const liquidationPriceFormatted = liquidationPrice.isZero()
        ? 'N/A'
        : numberFormat(liquidationPrice.toFixed(), {
            formatter: 'price',
          });
      return {
        entryPriceFormatted,
        markPriceFormatted,
        liquidationPriceFormatted,
      };
    }, [pos.entryPx, mid, pos.liquidationPx]);

    const sizeInfo = useMemo(() => {
      const sizeBN = new BigNumber(pos.szi || '0');
      const sizeAbs = sizeBN.abs().toFixed();
      const sizeAbsFormatted = numberFormat(sizeAbs, {
        formatter: 'balance',
        formatterOptions: {
          tokenSymbol: assetInfo.assetSymbol || '',
        },
      });
      const sizeValue = new BigNumber(pos.positionValue || '0').toFixed();
      const sizeValueFormatted = numberFormat(sizeValue, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
      });
      return {
        sizeAbsFormatted,
        sizeValue: sizeValueFormatted,
      };
    }, [pos.szi, pos.positionValue, assetInfo.assetSymbol]);

    const otherInfo = useMemo(() => {
      const pnlBn = new BigNumber(pos.unrealizedPnl || '0');
      const pnlAbs = pnlBn.abs().toFixed();
      const pnlFormatted = numberFormat(pnlAbs, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      let pnlColor = '$textSuccess';
      let pnlPlusOrMinus = '+';
      if (pnlBn.lt(0)) {
        pnlColor = '$textCritical';
        pnlPlusOrMinus = '-';
      }
      const marginUsedBN = new BigNumber(pos.marginUsed || '0');
      const marginUsedFormatted = numberFormat(marginUsedBN.toFixed(), {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      const fundingFormatted = numberFormat(pos.cumFunding.allTime, {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      });
      const roiPercent = marginUsedBN.gt(0)
        ? pnlBn.div(marginUsedBN).times(100).abs().toFixed(2)
        : '0';
      return {
        unrealizedPnl: pnlFormatted,
        marginUsedFormatted,
        fundingFormatted,
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

    if (isMobile) {
      return (
        <ListItem flex={1} flexDirection="column" alignItems="flex-start">
          <XStack gap="$2">
            <XStack
              w="$5"
              h="$5"
              justifyContent="center"
              alignItems="center"
              borderRadius="$1"
              backgroundColor={assetInfo.assetColor}
            >
              <SizableText size="$bodyMdMedium" color="$textOnColor">
                {side === 'long' ? 'B' : 'S'}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium" color="$text">
              {assetInfo.assetSymbol}
            </SizableText>
            <SizableText size="$bodySm" color={assetInfo.assetColor}>
              {`${side === 'long' ? 'Long' : 'Sell'} ${assetInfo.leverage}X`}
            </SizableText>
          </XStack>
          <XStack
            width="100%"
            justifyContent="space-between"
            alignItems="center"
          >
            <YStack gap="$1">
              <SizableText size="$bodySm" color="$textSubdued">
                PNL
              </SizableText>
              <SizableText size="$bodySm" color={otherInfo.pnlColor}>
                {`${otherInfo.unrealizedPnl as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                ROE
              </SizableText>
              <SizableText size="$bodySm" color={otherInfo.pnlColor}>
                {`${otherInfo.roiPercent}%`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <YStack gap="$1" width={120}>
              <SizableText size="$bodySm" color="$textSubdued">
                Positon Size
              </SizableText>
              <SizableText size="$bodySm">
                {`${sizeInfo.sizeAbsFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                Margin
              </SizableText>
              <SizableText size="$bodySm">
                {`${otherInfo.marginUsedFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" width={120} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                Entry Price
              </SizableText>
              <SizableText size="$bodySm">
                {`${priceInfo.entryPriceFormatted as string}`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <YStack gap="$1" width={120}>
              <SizableText size="$bodySm" color="$textSubdued">
                Funding
              </SizableText>
              <SizableText size="$bodySm">
                {`${otherInfo.fundingFormatted as string}`}
              </SizableText>
            </YStack>
            <YStack gap="$1" flex={1} alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                TPSL
              </SizableText>
              <SizableText size="$bodySm">{`${tpslInfo.tpsl}`}</SizableText>
            </YStack>
            <YStack gap="$1" width={120} alignItems="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                Liq. Price
              </SizableText>
              <SizableText size="$bodySm">
                {`${priceInfo.liquidationPriceFormatted as string}`}
              </SizableText>
            </YStack>
          </XStack>
          <XStack width="100%" justifyContent="space-between">
            <Button
              width={160}
              size="small"
              variant="secondary"
              onPress={setTpsl}
            >
              Set TP/SL
            </Button>
            <Button
              width={160}
              size="small"
              variant="secondary"
              onPress={onAllClose}
            >
              Close
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
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySmMedium"
            color={assetInfo.assetColor}
          >
            {assetInfo.assetSymbol}
          </SizableText>
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={assetInfo.assetColor}
          >
            {assetInfo.leverage}X
          </SizableText>
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
          >{`${priceInfo.entryPriceFormatted as string}`}</SizableText>
        </XStack>

        {/* Mark Price */}
        <XStack
          {...getColumnStyle(columnConfigs[3])}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${priceInfo.markPriceFormatted as string}`}</SizableText>
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
          >{`${priceInfo.liquidationPriceFormatted as string}`}</SizableText>
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
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${otherInfo.fundingFormatted as string}`}</SizableText>
        </XStack>

        {/* TPSL */}
        <XStack
          {...getColumnStyle(columnConfigs[8])}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
          alignItems="center"
        >
          {tpslInfo.showOrder ? (
            <Button
              size="small"
              variant="tertiary"
              onPress={handleViewTpslOrders}
            >
              <SizableText color="$textSuccess" size="$bodySm">
                View Order
              </SizableText>
            </Button>
          ) : (
            <XStack alignItems="center" gap="$1">
              <IconButton
                variant="tertiary"
                size="small"
                icon="HighlightOutline"
                iconSize="$2.5"
                onPress={setTpsl}
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
            <SizableText color="$textSuccess" size="$bodySm">
              Market
            </SizableText>
          </XStack>
          <XStack cursor="pointer" onPress={() => handleClosePosition('limit')}>
            <SizableText color="$textSuccess" size="$bodySm">
              Limit
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
