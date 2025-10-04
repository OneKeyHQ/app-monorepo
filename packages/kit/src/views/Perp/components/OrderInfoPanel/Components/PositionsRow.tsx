import {
  type PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

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
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { usePerpsOpenOrdersOfAsset } from '../../../hooks/usePerpsOpenOrdersOfAsset';
import { showAdjustPositionMarginDialog } from '../AdjustPositionMarginModal';
import { showClosePositionDialog } from '../ClosePositionModal';
import { showSetTpslDialog } from '../SetTpslModal';
import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { AssetPosition, FrontendOrder } from '@nktkas/hyperliquid';

interface IPositionRowProps {
  mockedPosition: {
    index: number;
  };
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  // tpslOrders: FrontendOrder[];
  handleViewTpslOrders: () => void;
  isMobile?: boolean;
}

interface IPositionRowContextValue {
  mockedPosition: {
    index: number;
  };
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  coin: string;
  decimals: number;
  side: 'long' | 'short';
  assetInfo: {
    assetSymbol: string;
    leverage: number | string;
    assetColor: string;
    leverageType: string;
  };
  sizeInfo: {
    sizeAbsFormatted: string | number;
    sizeValue: string | number;
  };
  priceInfo: {
    entryPriceFormatted: string;
    liquidationPriceFormatted: string;
  };
  otherInfo: {
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
  };
  tpslInfo: {
    tpsl: string;
    showOrder: boolean;
  };
  isIsolatedMode: boolean;
  isSizeViewChange: boolean;
  onChangeAsset: () => void;
  onSetTpsl: () => void;
  onClosePosition: (type: 'market' | 'limit') => void;
  onAdjustMargin: () => void;
  onViewTpslOrders: () => void;
  onSizeViewChange: () => void;
}

const PositionRowContext = createContext<IPositionRowContextValue | null>(null);

function usePositionRowContext() {
  const context = useContext(PositionRowContext);
  if (!context) {
    throw new OneKeyLocalError(
      'usePositionRowContext must be used within PositionRowProvider',
    );
  }
  return context;
}

function PositionRowProvider({
  children,
  value,
}: PropsWithChildren<{ value: IPositionRowContextValue }>) {
  return (
    <PositionRowContext.Provider value={value}>
      {children}
    </PositionRowContext.Provider>
  );
}

function MarkPrice({ coin, decimals }: { coin: string; decimals: number }) {
  const { midFormattedByDecimals } = usePerpsMidPrice({
    coin,
    szDecimals: decimals,
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

function useCurrentPositionFromMocked(mockedPosition: { index: number }): {
  position: AssetPosition['position'];
} {
  const [positions] = usePerpsActivePositionAtom();
  return {
    position: positions.activePositions[mockedPosition.index]?.position,
  };
}

const PositionRowDesktopSymbolAndLeverage = memo(() => {
  const { columnConfigs, assetInfo, onChangeAsset } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopSymbolAndLeverage"
      >
        <XStack
          {...getColumnStyle(columnConfigs[0])}
          alignItems="center"
          justifyContent={calcCellAlign(columnConfigs[0].align)}
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
                {assetInfo.leverageType} {assetInfo.leverage}X
              </SizableText>
            </YStack>
          </XStack>
        </XStack>
      </DebugRenderTracker>
    ),
    [columnConfigs, assetInfo, onChangeAsset],
  );
  return content;
});

PositionRowDesktopSymbolAndLeverage.displayName =
  'PositionRowDesktopSymbolAndLeverage';

const PositionRowDesktopPositionSize = memo(() => {
  const { columnConfigs, sizeInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopPositionSize"
      >
        <YStack
          {...getColumnStyle(columnConfigs[1])}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[1].align)}
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
    ),
    [columnConfigs, sizeInfo],
  );
  return content;
});

PositionRowDesktopPositionSize.displayName = 'PositionRowDesktopPositionSize';

const PositionRowDesktopEntryPrice = memo(() => {
  const { columnConfigs, priceInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopEntryPrice"
      >
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
      </DebugRenderTracker>
    ),
    [columnConfigs, priceInfo],
  );
  return content;
});

PositionRowDesktopEntryPrice.displayName = 'PositionRowDesktopEntryPrice';

const PositionRowDesktopMarkPrice = memo(() => {
  const { columnConfigs, coin, decimals } = usePositionRowContext();

  const content = useMemo(
    () => (
      <XStack
        {...getColumnStyle(columnConfigs[3])}
        justifyContent={calcCellAlign(columnConfigs[3].align)}
        alignItems="center"
      >
        <MarkPrice coin={coin} decimals={decimals} />
      </XStack>
    ),
    [columnConfigs, coin, decimals],
  );
  return content;
});

PositionRowDesktopMarkPrice.displayName = 'PositionRowDesktopMarkPrice';

const PositionRowDesktopLiqPrice = memo(() => {
  const { columnConfigs, priceInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopLiqPrice"
      >
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
      </DebugRenderTracker>
    ),
    [columnConfigs, priceInfo],
  );
  return content;
});

PositionRowDesktopLiqPrice.displayName = 'PositionRowDesktopLiqPrice';

const PositionRowDesktopPnL = memo(() => {
  const { columnConfigs, otherInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker position="bottom-right" name="PositionRowDesktopPnL">
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
            {`${otherInfo.pnlPlusOrMinus}${otherInfo.unrealizedPnl}(${otherInfo.pnlPlusOrMinus}${otherInfo.roiPercent}%)`}
          </SizableText>
        </XStack>
      </DebugRenderTracker>
    ),
    [columnConfigs, otherInfo],
  );
  return content;
});

PositionRowDesktopPnL.displayName = 'PositionRowDesktopPnL';

const PositionRowDesktopMargin = memo(() => {
  const { columnConfigs, otherInfo, isIsolatedMode, onAdjustMargin } =
    usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopMargin"
      >
        <XStack
          {...getColumnStyle(columnConfigs[6])}
          justifyContent={calcCellAlign(columnConfigs[6].align)}
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
    ),
    [columnConfigs, otherInfo, isIsolatedMode, onAdjustMargin],
  );
  return content;
});

PositionRowDesktopMargin.displayName = 'PositionRowDesktopMargin';

const PositionRowDesktopFunding = memo(() => {
  const intl = useIntl();
  const { columnConfigs, otherInfo, assetInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopFunding"
      >
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
    ),
    [columnConfigs, otherInfo, assetInfo, intl],
  );
  return content;
});

PositionRowDesktopFunding.displayName = 'PositionRowDesktopFunding';

const PositionRowDesktopTPSL = memo(() => {
  const intl = useIntl();
  const { columnConfigs, tpslInfo, onSetTpsl, onViewTpslOrders } =
    usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker position="bottom-right" name="PositionRowDesktopTPSL">
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
    ),
    [columnConfigs, tpslInfo, onSetTpsl, onViewTpslOrders, intl],
  );
  return content;
});

PositionRowDesktopTPSL.displayName = 'PositionRowDesktopTPSL';

const PositionRowDesktopActions = memo(() => {
  const intl = useIntl();
  const { columnConfigs, onClosePosition } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowDesktopActions"
        offsetY={10}
      >
        <XStack
          {...getColumnStyle(columnConfigs[9])}
          justifyContent={calcCellAlign(columnConfigs[9].align)}
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
    ),
    [columnConfigs, onClosePosition, intl],
  );
  return content;
});

PositionRowDesktopActions.displayName = 'PositionRowDesktopActions';

const PositionRowDesktop = memo(() => {
  const { mockedPosition, cellMinWidth } = usePositionRowContext();

  const content = useMemo(
    () => (
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
          <PositionRowDesktopSymbolAndLeverage />
          <PositionRowDesktopPositionSize />
          <PositionRowDesktopEntryPrice />
          <PositionRowDesktopMarkPrice />
          <PositionRowDesktopLiqPrice />
          <PositionRowDesktopPnL />
          <PositionRowDesktopMargin />
          <PositionRowDesktopFunding />
          <PositionRowDesktopTPSL />
          <PositionRowDesktopActions />
        </XStack>
      </DebugRenderTracker>
    ),
    [cellMinWidth, mockedPosition.index],
  );
  return content;
});

PositionRowDesktop.displayName = 'PositionRowDesktop';

const PositionRowMobileHeader = memo(() => {
  const intl = useIntl();
  const { side, assetInfo, onChangeAsset } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileHeader"
      >
        <XStack
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
            {assetInfo.leverageType} {assetInfo.leverage}X
          </SizableText>
        </XStack>
      </DebugRenderTracker>
    ),
    [side, assetInfo, onChangeAsset, intl],
  );
  return content;
});

PositionRowMobileHeader.displayName = 'PositionRowMobileHeader';

const PositionRowMobilePnLAndROE = memo(() => {
  const intl = useIntl();
  const { otherInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobilePnLAndROE"
      >
        <XStack width="100%" justifyContent="space-between" alignItems="center">
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
      </DebugRenderTracker>
    ),
    [otherInfo, intl],
  );
  return content;
});

PositionRowMobilePnLAndROE.displayName = 'PositionRowMobilePnLAndROE';

const PositionRowMobilePositionSize = memo(() => {
  const intl = useIntl();
  const { assetInfo, sizeInfo, isSizeViewChange, onSizeViewChange } =
    usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobilePositionSize"
      >
        <YStack gap="$1" width={120}>
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
              {`$${
                isSizeViewChange
                  ? sizeInfo.sizeValue
                  : sizeInfo.sizeAbsFormatted
              }`}
            </SizableText>
          </XStack>
        </YStack>
      </DebugRenderTracker>
    ),
    [assetInfo, sizeInfo, isSizeViewChange, onSizeViewChange, intl],
  );
  return content;
});

PositionRowMobilePositionSize.displayName = 'PositionRowMobilePositionSize';

const PositionRowMobileMargin = memo(() => {
  const intl = useIntl();
  const { otherInfo, isIsolatedMode, onAdjustMargin } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileMargin"
      >
        <YStack gap="$1" flex={1} alignItems="center">
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
      </DebugRenderTracker>
    ),
    [otherInfo, isIsolatedMode, onAdjustMargin, intl],
  );
  return content;
});

PositionRowMobileMargin.displayName = 'PositionRowMobileMargin';

const PositionRowMobileEntryPrice = memo(() => {
  const intl = useIntl();
  const { priceInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileEntryPrice"
      >
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
      </DebugRenderTracker>
    ),
    [priceInfo, intl],
  );
  return content;
});

PositionRowMobileEntryPrice.displayName = 'PositionRowMobileEntryPrice';

const PositionRowMobileFunding = memo(() => {
  const intl = useIntl();
  const { assetInfo, otherInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileFunding"
      >
        <YStack gap="$1" width={120}>
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
      </DebugRenderTracker>
    ),
    [assetInfo, otherInfo, intl],
  );
  return content;
});

PositionRowMobileFunding.displayName = 'PositionRowMobileFunding';

const PositionRowMobileTPSL = memo(() => {
  const intl = useIntl();
  const { tpslInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker position="bottom-right" name="PositionRowMobileTPSL">
        <YStack gap="$1" flex={1} alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_position_tp_sl,
            })}
          </SizableText>
          <SizableText size="$bodySmMedium">{`${tpslInfo.tpsl}`}</SizableText>
        </YStack>
      </DebugRenderTracker>
    ),
    [tpslInfo, intl],
  );
  return content;
});

PositionRowMobileTPSL.displayName = 'PositionRowMobileTPSL';

const PositionRowMobileLiqPrice = memo(() => {
  const intl = useIntl();
  const { priceInfo } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileLiqPrice"
      >
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
      </DebugRenderTracker>
    ),
    [priceInfo, intl],
  );
  return content;
});

PositionRowMobileLiqPrice.displayName = 'PositionRowMobileLiqPrice';

const PositionRowMobileActions = memo(() => {
  const intl = useIntl();
  const { onSetTpsl, onClosePosition } = usePositionRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="PositionRowMobileActions"
      >
        <XStack width="100%" gap="$2.5" justifyContent="space-between">
          <Button
            size="medium"
            variant="secondary"
            onPress={onSetTpsl}
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
      </DebugRenderTracker>
    ),
    [onSetTpsl, onClosePosition, intl],
  );
  return content;
});

PositionRowMobileActions.displayName = 'PositionRowMobileActions';

const PositionRowMobile = memo(() => {
  const content = useMemo(
    () => (
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
          <PositionRowMobileHeader />
          <PositionRowMobilePnLAndROE />
          <XStack width="100%" flex={1} alignItems="center">
            <PositionRowMobilePositionSize />
            <PositionRowMobileMargin />
            <PositionRowMobileEntryPrice />
          </XStack>
          <XStack width="100%" flex={1} alignItems="center">
            <PositionRowMobileFunding />
            <PositionRowMobileTPSL />
            <PositionRowMobileLiqPrice />
          </XStack>
          <PositionRowMobileActions />
        </ListItem>
      </DebugRenderTracker>
    ),
    [],
  );
  return content;
});

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
    }, [
      pos.unrealizedPnl,
      pos.marginUsed,
      pos.cumFunding.allTime,
      pos.cumFunding.sinceOpen,
      pos.cumFunding.sinceChange,
      formatters.valueFormatter,
    ]);

    const { openOrders: currentAssetOpenOrders } = usePerpsOpenOrdersOfAsset({
      coin,
    });
    const tpslInfo = useMemo(() => {
      const emptyPrice = '--';
      let tpPrice = emptyPrice;
      let slPrice = emptyPrice;
      let showOrder = false; // show goToOrders button
      let hasNonPositionTpslOrder = false;

      currentAssetOpenOrders.forEach((order) => {
        if (order.orderType.startsWith('Take')) {
          if (order.isPositionTpsl) {
            tpPrice = `${numberFormat(
              order.triggerPx,
              formatters.priceFormatter,
            )}`;
          } else {
            hasNonPositionTpslOrder = true;
          }
        }
        if (order.orderType.startsWith('Stop')) {
          if (order.isPositionTpsl) {
            slPrice = `${numberFormat(
              order.triggerPx,
              formatters.priceFormatter,
            )}`;
          } else {
            hasNonPositionTpslOrder = true;
          }
        }
      });

      if (
        hasNonPositionTpslOrder &&
        tpPrice === emptyPrice &&
        slPrice === emptyPrice
      ) {
        showOrder = true;
      }

      // <PositionRowMobileTPSL />
      // <PositionRowDesktopTPSL />
      return { tpsl: `${tpPrice}/${slPrice}`, showOrder };
    }, [formatters.priceFormatter, currentAssetOpenOrders]);

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
        coin: assetInfo.assetSymbol,
      });
    }, [actions, assetInfo.assetSymbol]);

    const handleClosePosition = useCallback(
      (type: 'market' | 'limit') => {
        showClosePositionDialog({ position: pos, type });
      },
      [pos],
    );

    const contextValue: IPositionRowContextValue = {
      mockedPosition,
      cellMinWidth,
      columnConfigs,
      coin,
      decimals,
      side,
      assetInfo,
      sizeInfo,
      priceInfo,
      otherInfo,
      tpslInfo,
      isIsolatedMode,
      isSizeViewChange,
      onChangeAsset: handleChangeAsset,
      onSetTpsl: handleSetTpsl,
      onClosePosition: handleClosePosition,
      onAdjustMargin: handleAdjustMargin,
      onViewTpslOrders: handleViewTpslOrders,
      onSizeViewChange: handleSizeViewChange,
    };

    return (
      <PositionRowProvider value={contextValue}>
        {isMobile ? <PositionRowMobile /> : <PositionRowDesktop />}
      </PositionRowProvider>
    );
  },
  (_prevProps) => {
    return false;
  },
);

PositionRow.displayName = 'PositionRow';
export { PositionRow };
