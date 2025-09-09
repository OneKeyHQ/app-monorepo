import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { calcCellAlign } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IPositionRowProps {
  pos: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  mid?: string;
  handleMarketClose: ({
    position,
  }: {
    position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  }) => void;
  handleLimitClose: ({
    position,
  }: {
    position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  }) => void;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  tpslOrders: FrontendOrder[];
  handleViewTpslOrders: () => void;
  onAllClose: () => void;
  setTpsl: () => void;
  isMobile?: boolean;
}

const PositionRow = memo(
  ({
    pos,
    mid,
    tpslOrders,
    cellMinWidth,
    columnConfigs,
    isMobile,
    handleMarketClose,
    handleLimitClose,
    handleViewTpslOrders,
    onAllClose,
    setTpsl,
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
      const liquidationPrice = new BigNumber(
        pos.liquidationPx || '0',
      ).toFixed();
      const entryPriceFormatted = numberFormat(entryPrice, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
      });
      const markPriceFormatted = numberFormat(markPrice, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
      });
      const liquidationPriceFormatted = numberFormat(liquidationPrice, {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
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
      return {
        sizeAbsFormatted,
        sizeValue,
      };
    }, [pos.szi, pos.positionValue, assetInfo.assetSymbol]);

    const otherInfo = useMemo(() => {
      const pnlBn = new BigNumber(pos.unrealizedPnl || '0');
      const pnlAbs = pnlBn.abs().toFixed();
      const pnlFormatted = numberFormat(pnlAbs, {
        formatter: 'value',
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
        showOrder = tpslOrders.some(
          (order) => !new BigNumber(order.origSz).isZero(),
        );
        if (!showOrder) {
          tpslOrders.forEach((order) => {
            if (order.orderType.startsWith('Take')) {
              tpPrice = `${
                numberFormat(order.triggerPx, {
                  formatter: 'price',
                  formatterOptions: {
                    currency: '$',
                  },
                }) as string
              }`;
            } else if (order.orderType.startsWith('Stop')) {
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
        {/* Symbol & Leverage */}
        <XStack
          width={columnConfigs[0].width}
          minWidth={columnConfigs[0].minWidth}
          flex={columnConfigs[0].flex}
          alignItems="center"
          justifyContent={calcCellAlign(columnConfigs[0].align)}
          gap="$2"
        >
          <SizableText size="$bodySmMedium" color={assetInfo.assetColor}>
            {assetInfo.assetSymbol}
          </SizableText>
          <SizableText size="$bodySm" color={assetInfo.assetColor}>
            {assetInfo.leverage}X
          </SizableText>
        </XStack>

        {/* Position Size */}
        <YStack
          width={columnConfigs[1].width}
          minWidth={columnConfigs[1].minWidth}
          flex={columnConfigs[1].flex}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[1].align)}
        >
          <SizableText size="$bodySm">
            {`${sizeInfo.sizeAbsFormatted as string}`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`$${sizeInfo.sizeValue}`}
          </SizableText>
        </YStack>

        {/* Entry Price */}
        <XStack
          width={columnConfigs[2].width}
          minWidth={columnConfigs[2].minWidth}
          flex={columnConfigs[2].flex}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            priceInfo.entryPriceFormatted as string
          }`}</SizableText>
        </XStack>

        {/* Mark Price */}
        <XStack
          width={columnConfigs[3].width}
          minWidth={columnConfigs[3].minWidth}
          flex={columnConfigs[3].flex}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            priceInfo.markPriceFormatted as string
          }`}</SizableText>
        </XStack>
        {/* Liq. Price */}
        <XStack
          width={columnConfigs[4].width}
          minWidth={columnConfigs[4].minWidth}
          flex={columnConfigs[4].flex}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            priceInfo.liquidationPriceFormatted as string
          }`}</SizableText>
        </XStack>
        {/* Unrealized PnL */}
        <XStack
          width={columnConfigs[5].width}
          minWidth={columnConfigs[5].minWidth}
          flex={columnConfigs[5].flex}
          justifyContent={calcCellAlign(columnConfigs[5].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm" color={otherInfo.pnlColor}>{`${
            otherInfo.pnlPlusOrMinus
          }$${otherInfo.unrealizedPnl as string}(${otherInfo.pnlPlusOrMinus}${
            otherInfo.roiPercent
          }%)`}</SizableText>
        </XStack>

        {/* Margin */}
        <XStack
          width={columnConfigs[6].width}
          minWidth={columnConfigs[6].minWidth}
          flex={columnConfigs[6].flex}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            otherInfo.marginUsedFormatted as string
          }`}</SizableText>
        </XStack>

        {/* Funding */}
        <XStack
          width={columnConfigs[7].width}
          minWidth={columnConfigs[7].minWidth}
          flex={columnConfigs[7].flex}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
        >
          <SizableText size="$bodySm">{`${
            otherInfo.fundingFormatted as string
          }`}</SizableText>
        </XStack>

        {/* TPSL */}
        <XStack
          width={columnConfigs[8].width}
          minWidth={columnConfigs[8].minWidth}
          flex={columnConfigs[8].flex}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
          alignItems="center"
        >
          {tpslInfo.showOrder ? (
            <Button
              size="small"
              variant="tertiary"
              onPress={handleViewTpslOrders}
            >
              View Order
            </Button>
          ) : (
            <SizableText size="$bodySm">{tpslInfo.tpsl}</SizableText>
          )}
        </XStack>

        {/* Actions */}
        <XStack
          width={columnConfigs[9].width}
          minWidth={columnConfigs[9].minWidth}
          flex={columnConfigs[9].flex}
          justifyContent={calcCellAlign(columnConfigs[9].align)}
          alignItems="center"
          gap="$2"
        >
          <Button size="small" variant="tertiary" onPress={handleMarketClose}>
            <SizableText size="$bodySm">Market</SizableText>
          </Button>
          <Button
            size="small"
            variant="tertiary"
            disabled
            onPress={handleLimitClose}
          >
            <SizableText size="$bodySm">Limit</SizableText>
          </Button>
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
