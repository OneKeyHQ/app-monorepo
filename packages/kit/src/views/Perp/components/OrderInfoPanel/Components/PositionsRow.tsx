import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  DebugRenderTracker,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
  usePerpsOpenOrdersByCoin,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getValidPriceDecimals,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { useShowPositionShare } from '../../../hooks/useShowPositionShare';
import { showAdjustPositionMarginDialog } from '../AdjustPositionMarginModal';
import { showClosePositionDialog } from '../ClosePositionModal';
import { showSetTpslDialog } from '../SetTpslModal';
import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';

interface IPositionRowProps {
  mockedPosition: {
    index: number;
  };
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  handleViewTpslOrders: () => void;
  isMobile?: boolean;
}

interface IAssetInfo {
  assetSymbol: string;
  rawCoin: string;
  leverage: number | string;
  assetColor: string;
  leverageType: string;
}

interface ISizeInfo {
  sizeAbsFormatted: string | number;
  sizeValue: string | number;
}

interface IPriceInfo {
  entryPriceFormatted: string;
  liquidationPriceFormatted: string;
}

interface IOtherInfo {
  unrealizedPnl: string | number;
  marginUsedFormatted: string | number;
  fundingAllTimeFormatted: string;
  fundingSinceOpenFormatted: string;
  fundingSinceChangeFormatted: string;
  fundingAllPlusOrMinus: string;
  fundingAllTimeColor: string;
  fundingSinceOpenPlusOrMinus: string;
  fundingSinceOpenColor: string;
  fundingSinceChangePlusOrMinus: string;
  fundingSinceChangeColor: string;
  roiPercent: string;
  pnlColor: string;
  pnlPlusOrMinus: string;
}

function MarkPrice({ coin }: { coin: string }) {
  const { midFormattedByDecimals } = usePerpsMidPrice({
    coin,
  });

  return useMemo(
    () => (
      <DebugRenderTracker position="bottom-right" name="MarkPrice" offsetY={10}>
        <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
          {midFormattedByDecimals}
        </SizableText>
      </DebugRenderTracker>
    ),
    [midFormattedByDecimals],
  );
}

const PositionRowDesktopSymbolAndLeverage = memo(
  ({
    columnConfig,
    assetInfo,
    onChangeAsset,
  }: {
    columnConfig: IColumnConfig;
    assetInfo: IAssetInfo;
    onChangeAsset: () => void;
  }) => {
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopSymbolAndLeverage"
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          alignItems="center"
          justifyContent={calcCellAlign(columnConfig.align)}
          gap="$2"
          pl="$2"
          cursor="pointer"
          onPress={onChangeAsset}
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
                {assetInfo.leverageType} {assetInfo.leverage}x
              </SizableText>
            </YStack>
          </XStack>
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopSymbolAndLeverage.displayName =
  'PositionRowDesktopSymbolAndLeverage';

const PositionRowDesktopPositionSize = memo(
  ({
    columnConfig,
    sizeInfo,
  }: {
    columnConfig: IColumnConfig;
    sizeInfo: ISizeInfo;
  }) => {
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopPositionSize"
      >
        <YStack
          {...getColumnStyle(columnConfig)}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfig.align)}
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {`${sizeInfo.sizeAbsFormatted}`}
          </SizableText>
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color="$textSubdued"
          >
            {`${sizeInfo.sizeValue}`}
          </SizableText>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopPositionSize.displayName = 'PositionRowDesktopPositionSize';

const PositionRowDesktopEntryPrice = memo(
  ({
    columnConfig,
    priceInfo,
  }: {
    columnConfig: IColumnConfig;
    priceInfo: IPriceInfo;
  }) => {
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopEntryPrice"
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${priceInfo.entryPriceFormatted}`}</SizableText>
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopEntryPrice.displayName = 'PositionRowDesktopEntryPrice';

const PositionRowDesktopMarkPrice = memo(
  ({ columnConfig, coin }: { columnConfig: IColumnConfig; coin: string }) => {
    const { midFormattedByDecimals } = usePerpsMidPrice({ coin });
    return (
      <XStack
        {...getColumnStyle(columnConfig)}
        justifyContent={calcCellAlign(columnConfig.align)}
        alignItems="center"
      >
        <DebugRenderTracker
          position="bottom-right"
          name="MarkPrice"
          offsetY={10}
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {midFormattedByDecimals}
          </SizableText>
        </DebugRenderTracker>
      </XStack>
    );
  },
);
PositionRowDesktopMarkPrice.displayName = 'PositionRowDesktopMarkPrice';

const PositionRowDesktopLiqPrice = memo(
  ({
    columnConfig,
    priceInfo,
  }: {
    columnConfig: IColumnConfig;
    priceInfo: IPriceInfo;
  }) => {
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopLiqPrice"
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
          >{`${priceInfo.liquidationPriceFormatted}`}</SizableText>
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopLiqPrice.displayName = 'PositionRowDesktopLiqPrice';

const PositionRowDesktopPnL = memo(
  ({
    columnConfig,
    otherInfo,
    onShare,
  }: {
    columnConfig: IColumnConfig;
    otherInfo: IOtherInfo;
    onShare: () => void;
  }) => {
    return (
      <DebugRenderTracker position="bottom-right" name="PositionRowDesktopPnL">
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
          gap="$1"
        >
          <SizableText
            size="$bodySm"
            color={otherInfo.pnlColor}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {`${otherInfo.pnlPlusOrMinus}${otherInfo.unrealizedPnl}(${otherInfo.pnlPlusOrMinus}${otherInfo.roiPercent}%)`}
          </SizableText>
          <IconButton
            variant="tertiary"
            size="small"
            icon="ShareOutline"
            iconSize="$3.5"
            onPress={onShare}
            cursor="pointer"
          />
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopPnL.displayName = 'PositionRowDesktopPnL';

const PositionRowDesktopMargin = memo(
  ({
    columnConfig,
    otherInfo,
    isIsolatedMode,
    onAdjustMargin,
  }: {
    columnConfig: IColumnConfig;
    otherInfo: IOtherInfo;
    isIsolatedMode: boolean;
    onAdjustMargin: () => void;
  }) => {
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopMargin"
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
        >
          <XStack alignItems="center" gap="$1">
            <SizableText
              numberOfLines={1}
              ellipsizeMode="tail"
              size="$bodySm"
            >{`${otherInfo.marginUsedFormatted}`}</SizableText>
            {isIsolatedMode ? (
              <IconButton
                variant="tertiary"
                size="small"
                icon="PencilOutline"
                iconSize="$3"
                onPress={onAdjustMargin}
                cursor="pointer"
              />
            ) : null}
          </XStack>
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopMargin.displayName = 'PositionRowDesktopMargin';

const PositionRowDesktopFunding = memo(
  ({
    columnConfig,
    otherInfo,
    assetInfo,
  }: {
    columnConfig: IColumnConfig;
    otherInfo: IOtherInfo;
    assetInfo: IAssetInfo;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopFunding"
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
        >
          <Tooltip
            renderTrigger={
              <SizableText
                numberOfLines={1}
                ellipsizeMode="tail"
                size="$bodySm"
                cursor="help"
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
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopFunding.displayName = 'PositionRowDesktopFunding';

const PositionRowDesktopTPSL = memo(
  ({
    columnConfig,
    coin,
    onSetTpsl,
    onViewTpslOrders,
  }: {
    columnConfig: IColumnConfig;
    coin: string;
    onSetTpsl: () => void;
    onViewTpslOrders: () => void;
  }) => {
    const intl = useIntl();
    const currentAssetOpenOrders = usePerpsOpenOrdersByCoin(coin);
    const tpslInfo = useMemo(() => {
      const emptyPrice = '--';
      let tpPrice = emptyPrice;
      let slPrice = emptyPrice;
      let showOrder = false; // show goToOrders button
      let hasNonPositionTpslOrder = false;

      currentAssetOpenOrders.forEach((order) => {
        if (order.isPositionTpsl) {
          if (order.orderType.startsWith('Take')) {
            tpPrice = order.triggerPx;
          }
          if (order.orderType.startsWith('Stop')) {
            slPrice = order.triggerPx;
          }
        } else {
          hasNonPositionTpslOrder = true;
        }
      });

      if (
        hasNonPositionTpslOrder &&
        tpPrice === emptyPrice &&
        slPrice === emptyPrice
      ) {
        showOrder = true;
      }

      return { tpsl: `${tpPrice}/${slPrice}`, showOrder };
    }, [currentAssetOpenOrders]);

    return (
      <DebugRenderTracker position="bottom-right" name="PositionRowDesktopTPSL">
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
        >
          {tpslInfo.showOrder ? (
            <XStack alignItems="center" gap="$1">
              <IconButton
                variant="tertiary"
                size="small"
                icon="HighlightOutline"
                iconSize="$3"
                onPress={onSetTpsl}
                cursor="pointer"
              />

              <SizableText
                cursor="pointer"
                hoverStyle={{ size: '$bodySmMedium' }}
                color="$green11"
                size="$bodySm"
                onPress={onViewTpslOrders}
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
                onPress={onSetTpsl}
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
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopTPSL.displayName = 'PositionRowDesktopTPSL';

const PositionRowDesktopActions = memo(
  ({
    columnConfig,
    onClosePosition,
  }: {
    columnConfig: IColumnConfig;
    onClosePosition: (type: 'market' | 'limit') => void;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopActions"
        offsetY={10}
      >
        <XStack
          {...getColumnStyle(columnConfig)}
          justifyContent={calcCellAlign(columnConfig.align)}
          alignItems="center"
          gap="$2"
        >
          <XStack cursor="pointer" onPress={() => onClosePosition('market')}>
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
          <XStack cursor="pointer" onPress={() => onClosePosition('limit')}>
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
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktopActions.displayName = 'PositionRowDesktopActions';

interface IPositionRowDesktopProps {
  mockedPosition: { index: number };
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  assetInfo: IAssetInfo;
  sizeInfo: ISizeInfo;
  priceInfo: IPriceInfo;
  otherInfo: IOtherInfo;
  coin: string;
  isIsolatedMode: boolean;
  onChangeAsset: () => void;
  onSetTpsl: () => void;
  onClosePosition: (type: 'market' | 'limit') => void;
  onAdjustMargin: () => void;
  onViewTpslOrders: () => void;
  onShare: () => void;
}

const PositionRowDesktop = memo(
  ({
    mockedPosition,
    cellMinWidth,
    columnConfigs,
    assetInfo,
    sizeInfo,
    priceInfo,
    otherInfo,
    coin,
    isIsolatedMode,
    onChangeAsset,
    onSetTpsl,
    onClosePosition,
    onAdjustMargin,
    onViewTpslOrders,
    onShare,
  }: IPositionRowDesktopProps) => {
    return (
      <DebugRenderTracker
        position="left-center"
        offsetX={10}
        name="PositionRowDesktop"
      >
        <XStack
          minWidth={cellMinWidth}
          py="$1.5"
          px="$3"
          display="flex"
          flex={1}
          alignItems="center"
          hoverStyle={{ bg: '$bgHover' }}
          {...(mockedPosition.index % 2 === 1 && {
            backgroundColor: '$bgSubdued',
          })}
        >
          <PositionRowDesktopSymbolAndLeverage
            columnConfig={columnConfigs[0]}
            assetInfo={assetInfo}
            onChangeAsset={onChangeAsset}
          />
          <PositionRowDesktopPositionSize
            columnConfig={columnConfigs[1]}
            sizeInfo={sizeInfo}
          />
          <PositionRowDesktopEntryPrice
            columnConfig={columnConfigs[2]}
            priceInfo={priceInfo}
          />
          <PositionRowDesktopMarkPrice
            columnConfig={columnConfigs[3]}
            coin={coin}
          />
          <PositionRowDesktopLiqPrice
            columnConfig={columnConfigs[4]}
            priceInfo={priceInfo}
          />
          <PositionRowDesktopPnL
            columnConfig={columnConfigs[5]}
            otherInfo={otherInfo}
            onShare={onShare}
          />
          <PositionRowDesktopMargin
            columnConfig={columnConfigs[6]}
            otherInfo={otherInfo}
            isIsolatedMode={isIsolatedMode}
            onAdjustMargin={onAdjustMargin}
          />
          <PositionRowDesktopFunding
            columnConfig={columnConfigs[7]}
            otherInfo={otherInfo}
            assetInfo={assetInfo}
          />
          <PositionRowDesktopTPSL
            columnConfig={columnConfigs[8]}
            coin={coin}
            onSetTpsl={onSetTpsl}
            onViewTpslOrders={onViewTpslOrders}
          />
          <PositionRowDesktopActions
            columnConfig={columnConfigs[9]}
            onClosePosition={onClosePosition}
          />
        </XStack>
      </DebugRenderTracker>
    );
  },
);
PositionRowDesktop.displayName = 'PositionRowDesktop';

const PositionRowMobileHeader = memo(
  ({
    side,
    assetInfo,
    onChangeAsset,
    onShare,
  }: {
    side: 'long' | 'short';
    assetInfo: IAssetInfo;
    onChangeAsset: () => void;
    onShare: () => void;
  }) => {
    const intl = useIntl();

    return (
      <XStack justifyContent="space-between" flex={1} position="relative">
        <XStack
          flex={1}
          gap="$2"
          alignItems="center"
          cursor="pointer"
          onPress={onChangeAsset}
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
            {assetInfo.leverageType} {assetInfo.leverage}x
          </SizableText>
        </XStack>
        <IconButton
          variant="tertiary"
          size="small"
          icon="ShareOutline"
          iconSize="$3.5"
          onPress={onShare}
          cursor="pointer"
        />
      </XStack>
    );
  },
);
PositionRowMobileHeader.displayName = 'PositionRowMobileHeader';

const PositionRowMobilePnLAndROE = memo(
  ({ otherInfo }: { otherInfo: IOtherInfo }) => {
    const intl = useIntl();

    return (
      <XStack
        width="100%"
        justifyContent="space-between"
        alignItems="center"
        position="relative"
      >
        <YStack gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_position_pnl_mobile,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium" color={otherInfo.pnlColor}>
            {`${otherInfo.pnlPlusOrMinus}${otherInfo.unrealizedPnl}`}
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
    );
  },
);
PositionRowMobilePnLAndROE.displayName = 'PositionRowMobilePnLAndROE';

const PositionRowMobilePositionSize = memo(
  ({
    assetInfo,
    sizeInfo,
    isSizeViewChange,
    onSizeViewChange,
  }: {
    assetInfo: IAssetInfo;
    sizeInfo: ISizeInfo;
    isSizeViewChange: boolean;
    onSizeViewChange: () => void;
  }) => {
    const intl = useIntl();

    return (
      <YStack gap="$1" width={120} position="relative">
        <XStack alignItems="center" gap="$1" onPress={onSizeViewChange}>
          <XStack alignItems="center" gap="$0.5">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_position_size,
              })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`${isSizeViewChange ? '(USD)' : `(${assetInfo.assetSymbol})`}`}
            </SizableText>
          </XStack>
          <Icon name="RepeatOutline" size="$3" color="$textSubdued" />
        </XStack>
        <XStack alignItems="center" gap="$1" cursor="pointer">
          <SizableText size="$bodySmMedium">
            {isSizeViewChange
              ? `$${sizeInfo.sizeValue}`
              : sizeInfo.sizeAbsFormatted}
          </SizableText>
        </XStack>
      </YStack>
    );
  },
);
PositionRowMobilePositionSize.displayName = 'PositionRowMobilePositionSize';

const PositionRowMobileMargin = memo(
  ({
    otherInfo,
    isIsolatedMode,
    onAdjustMargin,
  }: {
    otherInfo: IOtherInfo;
    isIsolatedMode: boolean;
    onAdjustMargin: () => void;
  }) => {
    const intl = useIntl();

    return (
      <YStack gap="$1" flex={1} alignItems="center" position="relative">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_position_margin,
          })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodySmMedium">
            {`${otherInfo.marginUsedFormatted}`}
          </SizableText>
          {isIsolatedMode ? (
            <IconButton
              variant="tertiary"
              size="small"
              icon="PencilOutline"
              iconSize="$3"
              onPress={onAdjustMargin}
              cursor="pointer"
            />
          ) : null}
        </XStack>
      </YStack>
    );
  },
);
PositionRowMobileMargin.displayName = 'PositionRowMobileMargin';

const PositionRowMobileEntryPrice = memo(
  ({ priceInfo }: { priceInfo: IPriceInfo }) => {
    const intl = useIntl();

    return (
      <YStack gap="$1" width={120} alignItems="flex-end" position="relative">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_position_entry_price,
          })}
        </SizableText>
        <SizableText size="$bodySmMedium">
          {`${priceInfo.entryPriceFormatted}`}
        </SizableText>
      </YStack>
    );
  },
);
PositionRowMobileEntryPrice.displayName = 'PositionRowMobileEntryPrice';

const PositionRowMobileFunding = memo(
  ({
    assetInfo,
    otherInfo,
  }: {
    assetInfo: IAssetInfo;
    otherInfo: IOtherInfo;
  }) => {
    const intl = useIntl();
    return (
      <YStack gap="$1" width={120} position="relative">
        <Popover
          title={intl.formatMessage({
            id: ETranslations.perp_position_funding_2,
          })}
          renderTrigger={
            <DashText
              size="$bodySm"
              color="$textSubdued"
              dashColor="$textDisabled"
              dashThickness={0.5}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_funding_2,
              })}
            </DashText>
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
    );
  },
);
PositionRowMobileFunding.displayName = 'PositionRowMobileFunding';

const PositionRowMobileTPSL = memo(({ coin }: { coin: string }) => {
  const intl = useIntl();
  const currentAssetOpenOrders = usePerpsOpenOrdersByCoin(coin);
  const tpslInfo = useMemo(() => {
    const emptyPrice = '--';
    let tpPrice = emptyPrice;
    let slPrice = emptyPrice;
    // Mobile only displays price, doesn't need showOrder logic
    currentAssetOpenOrders.forEach((order) => {
      if (order.isPositionTpsl) {
        if (order.orderType.startsWith('Take')) {
          tpPrice = order.triggerPx;
        }
        if (order.orderType.startsWith('Stop')) {
          slPrice = order.triggerPx;
        }
      }
    });

    return { tpsl: `${tpPrice}/${slPrice}` };
  }, [currentAssetOpenOrders]);

  return (
    <YStack gap="$1" flex={1} alignItems="center" position="relative">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_position_tp_sl,
        })}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        numberOfLines={1}
      >{`${tpslInfo.tpsl}`}</SizableText>
    </YStack>
  );
});
PositionRowMobileTPSL.displayName = 'PositionRowMobileTPSL';

const PositionRowMobileMarkPrice = memo(({ coin }: { coin: string }) => {
  const intl = useIntl();
  const { midFormattedByDecimals } = usePerpsMidPrice({ coin });

  return (
    <YStack gap="$1" flex={1} alignItems="center" position="relative">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_position_mark_price,
        })}
      </SizableText>
      <SizableText size="$bodySmMedium" numberOfLines={1}>
        {midFormattedByDecimals || '--'}
      </SizableText>
    </YStack>
  );
});
PositionRowMobileMarkPrice.displayName = 'PositionRowMobileMarkPrice';

const PositionRowMobileLiqPrice = memo(
  ({ priceInfo }: { priceInfo: IPriceInfo }) => {
    const intl = useIntl();
    return (
      <YStack gap="$1" width={120} alignItems="flex-end" position="relative">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_position_liq_price,
          })}
        </SizableText>
        <SizableText size="$bodySmMedium">
          {`${priceInfo.liquidationPriceFormatted}`}
        </SizableText>
      </YStack>
    );
  },
);
PositionRowMobileLiqPrice.displayName = 'PositionRowMobileLiqPrice';

const PositionRowMobileActions = memo(
  ({
    onSetTpsl,
    onClosePosition,
  }: {
    onSetTpsl: () => void;
    onClosePosition: (type: 'market' | 'limit') => void;
  }) => {
    const intl = useIntl();
    return (
      <XStack
        width="100%"
        gap="$2.5"
        justifyContent="space-between"
        position="relative"
      >
        <Button size="medium" variant="secondary" onPress={onSetTpsl} flex={1}>
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.perp_trade_set_tp_sl,
            })}
          </SizableText>
        </Button>
        <Button
          size="medium"
          variant="secondary"
          onPress={() => onClosePosition('market')}
          flex={1}
        >
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.perp_close_position_title,
            })}
          </SizableText>
        </Button>
      </XStack>
    );
  },
);
PositionRowMobileActions.displayName = 'PositionRowMobileActions';

interface IPositionRowMobileProps {
  side: 'long' | 'short';
  assetInfo: IAssetInfo;
  sizeInfo: ISizeInfo;
  priceInfo: IPriceInfo;
  otherInfo: IOtherInfo;
  coin: string;
  isIsolatedMode: boolean;
  isSizeViewChange: boolean;
  onChangeAsset: () => void;
  onSetTpsl: () => void;
  onClosePosition: (type: 'market' | 'limit') => void;
  onAdjustMargin: () => void;
  onSizeViewChange: () => void;
  onShare: () => void;
}

const PositionRowMobile = memo(
  ({
    side,
    assetInfo,
    sizeInfo,
    priceInfo,
    otherInfo,
    coin,
    isIsolatedMode,
    isSizeViewChange,
    onChangeAsset,
    onSetTpsl,
    onClosePosition,
    onAdjustMargin,
    onSizeViewChange,
    onShare,
  }: IPositionRowMobileProps) => {
    return (
      <DebugRenderTracker
        position="bottom-left"
        offsetX={10}
        name="PositionRowMobile"
      >
        <ListItem
          flex={1}
          mt="$1.5"
          flexDirection="column"
          alignItems="flex-start"
        >
          <PositionRowMobileHeader
            side={side}
            assetInfo={assetInfo}
            onChangeAsset={onChangeAsset}
            onShare={onShare}
          />
          <PositionRowMobilePnLAndROE otherInfo={otherInfo} />
          <XStack width="100%" flex={1} alignItems="center">
            <PositionRowMobilePositionSize
              assetInfo={assetInfo}
              sizeInfo={sizeInfo}
              isSizeViewChange={isSizeViewChange}
              onSizeViewChange={onSizeViewChange}
            />
            <PositionRowMobileMargin
              otherInfo={otherInfo}
              isIsolatedMode={isIsolatedMode}
              onAdjustMargin={onAdjustMargin}
            />
            <PositionRowMobileEntryPrice priceInfo={priceInfo} />
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <PositionRowMobileFunding
              assetInfo={assetInfo}
              otherInfo={otherInfo}
            />
            <PositionRowMobileMarkPrice coin={coin} />
            <PositionRowMobileLiqPrice priceInfo={priceInfo} />
          </XStack>
          <PositionRowMobileActions
            onSetTpsl={onSetTpsl}
            onClosePosition={onClosePosition}
          />
        </ListItem>
      </DebugRenderTracker>
    );
  },
);
PositionRowMobile.displayName = 'PositionRowMobile';

const PositionRow = memo(
  ({
    mockedPosition,
    cellMinWidth,
    columnConfigs,
    isMobile,
    handleViewTpslOrders,
  }: IPositionRowProps) => {
    const navigation = useAppNavigation();
    const actions = useHyperliquidActions();
    const intl = useIntl();
    const [positions] = usePerpsActivePositionAtom();
    const pos = useMemo(() => {
      return positions.activePositions[mockedPosition.index]?.position;
    }, [positions.activePositions, mockedPosition.index]);
    const coin = useMemo(() => {
      return pos?.coin;
    }, [pos?.coin]);
    const side = useMemo(() => {
      return parseFloat(pos.szi || '0') >= 0 ? 'long' : 'short';
    }, [pos.szi]);

    const formatters = useMemo(() => {
      const priceFormatter: INumberFormatProps = {
        formatter: 'price',
        formatterOptions: {
          currency: '$',
        },
      };

      const valueFormatter: INumberFormatProps = {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      };

      const balanceFormatter: INumberFormatProps = {
        formatter: 'balance',
      };

      const sizeValueFormatter: INumberFormatProps = {
        formatter: 'balance',
        formatterOptions: {
          currency: isMobile ? '' : '$',
        },
      };

      return {
        priceFormatter,
        valueFormatter,
        balanceFormatter,
        sizeValueFormatter,
      };
    }, [isMobile]);

    const assetInfo = useMemo(() => {
      const parsed = parseDexCoin(pos.coin);
      const leverageType =
        pos.leverage?.type === 'cross'
          ? intl.formatMessage({
              id: ETranslations.perp_trade_cross,
            })
          : intl.formatMessage({
              id: ETranslations.perp_trade_isolated,
            });
      return {
        assetSymbol: parsed.displayName,
        rawCoin: pos.coin,
        leverage: pos.leverage?.value ?? '',
        assetColor: side === 'long' ? '$green11' : '$red11',
        leverageType,
      };
    }, [intl, pos.coin, pos.leverage?.type, pos.leverage?.value, side]);
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
      const sizeAbsFormatted = numberFormat(
        sizeAbs,
        formatters.balanceFormatter,
      );
      const sizeValue = new BigNumber(pos.positionValue || '0').toFixed();
      const sizeValueFormatted = numberFormat(
        sizeValue,
        formatters.sizeValueFormatter,
      );
      return {
        sizeAbsFormatted,
        sizeValue: sizeValueFormatted,
      };
    }, [
      pos.szi,
      pos.positionValue,
      formatters.balanceFormatter,
      formatters.sizeValueFormatter,
    ]);

    const otherInfo = useMemo(() => {
      const pnlBn = new BigNumber(pos.unrealizedPnl || '0');
      const pnlAbs = pnlBn.abs().toFixed();
      const pnlFormatted = numberFormat(pnlAbs, formatters.valueFormatter);
      let pnlColor = '$green11';
      let pnlPlusOrMinus = '+';
      if (pnlBn.lt(0)) {
        pnlColor = '$red11';
        pnlPlusOrMinus = '-';
      }
      const marginUsedBN = new BigNumber(pos.marginUsed || '0');
      const marginUsedFormatted = numberFormat(
        marginUsedBN.toFixed(),
        formatters.valueFormatter,
      );

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
      const roiPercentBN = new BigNumber(
        pos.returnOnEquity || '0',
      ).multipliedBy(100);
      const roiPercent = roiPercentBN.abs().toFixed(1);
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
    }, [
      formatters.valueFormatter,
      pos.cumFunding.allTime,
      pos.cumFunding.sinceChange,
      pos.cumFunding.sinceOpen,
      pos.marginUsed,
      pos.returnOnEquity,
      pos.unrealizedPnl,
    ]);

    const [isSizeViewChange, setIsSizeViewChange] = useState(false);
    const handleSizeViewChange = useCallback(() => {
      setIsSizeViewChange(!isSizeViewChange);
    }, [isSizeViewChange]);

    const isIsolatedMode = useMemo(() => {
      return pos.leverage?.type === 'isolated';
    }, [pos.leverage?.type]);

    const handleAdjustMargin = useCallback(() => {
      showAdjustPositionMarginDialog({ coin });
    }, [coin]);

    const handleSetTpsl = useCallback(async () => {
      await actions.current.showSetPositionTpslUI({
        position: pos,
        isMobile: isMobile ?? false,
        onShowDialog: showSetTpslDialog,
        navigation,
      });
    }, [isMobile, navigation, actions, pos]);

    const handleChangeAsset = useCallback(() => {
      void actions.current.changeActiveAsset({
        coin: assetInfo.rawCoin,
      });
    }, [actions, assetInfo.rawCoin]);

    const handleClosePosition = useCallback(
      (type: 'market' | 'limit') => {
        showClosePositionDialog({ position: pos, type });
      },
      [pos],
    );

    const { showPositionShare } = useShowPositionShare();

    const handleShare = useCallback(async () => {
      const priceData = await actions.current.getMidPrice({ coin });
      const markPriceFormatted = priceData?.midFormattedByDecimals
        ? new BigNumber(priceData.midFormattedByDecimals).toFixed(decimals)
        : '0';

      const roiPercentBN = new BigNumber(pos.returnOnEquity || '0');
      const pnlPercent = roiPercentBN.multipliedBy(100).toFixed(1);
      const parsed = parseDexCoin(pos.coin);

      showPositionShare({
        side: parseFloat(pos.szi) >= 0 ? 'long' : 'short',
        token: pos.coin,
        tokenDisplayName: parsed.displayName,
        pnl: pos.unrealizedPnl,
        pnlPercent,
        leverage: pos.leverage?.value || 0,
        entryPrice: pos.entryPx,
        markPrice: markPriceFormatted,
        priceType: 'mark',
      });
    }, [showPositionShare, pos, decimals, coin, actions]);

    if (isMobile) {
      return (
        <PositionRowMobile
          side={side}
          assetInfo={assetInfo}
          sizeInfo={sizeInfo}
          priceInfo={priceInfo}
          otherInfo={otherInfo}
          coin={coin}
          isIsolatedMode={isIsolatedMode}
          isSizeViewChange={isSizeViewChange}
          onChangeAsset={handleChangeAsset}
          onSetTpsl={handleSetTpsl}
          onClosePosition={handleClosePosition}
          onAdjustMargin={handleAdjustMargin}
          onSizeViewChange={handleSizeViewChange}
          onShare={handleShare}
        />
      );
    }

    return (
      <PositionRowDesktop
        mockedPosition={mockedPosition}
        cellMinWidth={cellMinWidth}
        columnConfigs={columnConfigs}
        assetInfo={assetInfo}
        sizeInfo={sizeInfo}
        priceInfo={priceInfo}
        otherInfo={otherInfo}
        coin={coin}
        isIsolatedMode={isIsolatedMode}
        onChangeAsset={handleChangeAsset}
        onSetTpsl={handleSetTpsl}
        onClosePosition={handleClosePosition}
        onAdjustMargin={handleAdjustMargin}
        onViewTpslOrders={handleViewTpslOrders}
        onShare={handleShare}
      />
    );
  },
);

PositionRow.displayName = 'PositionRow';
export { PositionRow, MarkPrice };
