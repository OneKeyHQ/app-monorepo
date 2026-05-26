import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IPerpsActiveTwapOrder } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpTestIDs } from '../../../testIDs';
import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig, IRenderMode } from '../List/CommonTableListView';

const balanceFormatter: INumberFormatProps = {
  formatter: 'balance',
};

const valueFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

interface ITwapOpenOrdersRowProps {
  order: IPerpsActiveTwapOrder;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  onCancelOrder: () => void;
  isMobile?: boolean;
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
}

const TwapOpenOrdersRow = memo(
  ({
    order,
    cellMinWidth,
    columnConfigs,
    onCancelOrder,
    isMobile,
    index,
    renderMode = 'full',
    isHovered,
    onHoverChange,
  }: ITwapOpenOrdersRowProps) => {
    const intl = useIntl();
    const { twapId, state } = order;
    const assetSymbol = useMemo(
      () => parseDexCoin(state.coin).displayName,
      [state.coin],
    );
    const dateInfo = useMemo(() => {
      const timeDate = new Date(state.timestamp);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const time = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time };
    }, [state.timestamp]);

    const baseInfo = useMemo(() => {
      const executedSize = new BigNumber(state.executedSz);
      const totalSize = new BigNumber(state.sz);
      const remainingSize = BigNumber.max(totalSize.minus(executedSize), 0);
      const progressPercent =
        totalSize.gt(0) && executedSize.gte(0)
          ? BigNumber.min(executedSize.dividedBy(totalSize), 1)
              .multipliedBy(100)
              .toFixed(0)
          : undefined;
      const progressText =
        totalSize.gt(0) && executedSize.gte(0)
          ? `${numberFormat(
              executedSize.toFixed(),
              balanceFormatter,
            )} / ${numberFormat(totalSize.toFixed(), balanceFormatter)}${
              progressPercent ? ` · ${progressPercent}%` : ''
            }`
          : `${state.executedSz} / ${state.sz}`;
      const execution = `${state.minutes}m${
        state.randomize ? ' · Random' : ''
      }`;
      return {
        remainingSizeFormatted: numberFormat(
          remainingSize.toFixed(),
          balanceFormatter,
        ),
        totalSizeFormatted: numberFormat(state.sz, balanceFormatter),
        progressText,
        executedValueFormatted: numberFormat(state.executedNtl, valueFormatter),
        execution,
      };
    }, [state]);

    const sideText = useMemo(() => {
      if (state.side === 'B') {
        return state.reduceOnly
          ? intl.formatMessage({ id: ETranslations.perp_order_close_short })
          : intl.formatMessage({ id: ETranslations.perp_long });
      }
      return state.reduceOnly
        ? intl.formatMessage({ id: ETranslations.perp_order_close_long })
        : intl.formatMessage({ id: ETranslations.perp_short });
    }, [intl, state.reduceOnly, state.side]);
    const typeColor = state.side === 'B' ? '$green11' : '$red11';

    const isOddRow = index % 2 === 1;
    const baseBgColor = isOddRow ? '$bgSubdued' : '$bgApp';
    const bgColor = isHovered ? '$bgHover' : baseBgColor;

    const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';
    const shouldRenderRight = renderMode === 'full' || renderMode === 'right';

    if (isMobile) {
      return (
        <ListItem
          flex={1}
          mt="$1.5"
          flexDirection="column"
          alignItems="flex-start"
          bg="$bgSubdued"
          borderRadius="$3"
        >
          <XStack
            justifyContent="space-between"
            width="100%"
            alignItems="center"
          >
            <YStack flex={1}>
              <SizableText size="$bodyMdMedium">
                {assetSymbol} · TWAP
              </SizableText>
              <SizableText size="$bodySm" color={typeColor}>
                {sideText} · {baseInfo.execution}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {dateInfo.date} {dateInfo.time}
              </SizableText>
            </YStack>
            <Button
              testID={PerpTestIDs.CancelOrderButton(twapId)}
              size="small"
              variant="secondary"
              onPress={onCancelOrder}
            >
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_open_orders_cancel,
                })}
              </SizableText>
            </Button>
          </XStack>
          <XStack width="100%" justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              Filled
            </SizableText>
            <SizableText size="$bodySm">{baseInfo.progressText}</SizableText>
          </XStack>
          <XStack width="100%" justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              Value
            </SizableText>
            <SizableText size="$bodySm">
              {baseInfo.executedValueFormatted}
            </SizableText>
          </XStack>
        </ListItem>
      );
    }

    return (
      <XStack
        flex={1}
        py="$1.5"
        pl="$5"
        pr="$3"
        alignItems="center"
        backgroundColor={bgColor}
        onHoverIn={() => onHoverChange?.(index)}
        onHoverOut={() => onHoverChange?.(null)}
        minWidth={renderMode === 'full' ? cellMinWidth : undefined}
      >
        {shouldRenderLeft ? (
          <>
            <YStack
              {...getColumnStyle(columnConfigs[0])}
              justifyContent="center"
              alignItems={calcCellAlign(columnConfigs[0].align)}
            >
              <SizableText size="$bodySm">{dateInfo.date}</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {dateInfo.time}
              </SizableText>
            </YStack>
            <YStack
              {...getColumnStyle(columnConfigs[1])}
              justifyContent="center"
              alignItems={calcCellAlign(columnConfigs[1].align)}
            >
              <SizableText size="$bodySm" fontWeight={600} color={typeColor}>
                {assetSymbol}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                TWAP
              </SizableText>
            </YStack>
            <XStack
              {...getColumnStyle(columnConfigs[2])}
              justifyContent={calcCellAlign(columnConfigs[2].align)}
              alignItems="center"
            >
              <YStack>
                <SizableText size="$bodySm" color={typeColor}>
                  TWAP / {sideText}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  #{twapId}
                </SizableText>
              </YStack>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[3])}
              justifyContent={calcCellAlign(columnConfigs[3].align)}
              alignItems="center"
            >
              <YStack>
                <SizableText size="$bodySm">
                  {baseInfo.remainingSizeFormatted}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  Filled {baseInfo.progressText}
                </SizableText>
              </YStack>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[4])}
              justifyContent={calcCellAlign(columnConfigs[4].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {baseInfo.totalSizeFormatted}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[5])}
              justifyContent={calcCellAlign(columnConfigs[5].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {baseInfo.executedValueFormatted}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[6])}
              justifyContent={calcCellAlign(columnConfigs[6].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">Market slices</SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[7])}
              justifyContent={calcCellAlign(columnConfigs[7].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {state.reduceOnly ? 'Yes' : 'No'}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[8])}
              justifyContent={calcCellAlign(columnConfigs[8].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">{baseInfo.execution}</SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[9])}
              justifyContent={calcCellAlign(columnConfigs[9].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            </XStack>
          </>
        ) : null}

        {shouldRenderRight ? (
          <XStack
            {...getColumnStyle(columnConfigs[10])}
            justifyContent={calcCellAlign(columnConfigs[10].align)}
            alignItems="center"
            cursor="default"
          >
            <SizableText
              color="$green11"
              hoverStyle={{ size: '$bodySmMedium', fontWeight: 600 }}
              size="$bodySm"
              fontWeight={400}
              onPress={onCancelOrder}
            >
              {intl.formatMessage({
                id: ETranslations.perp_open_orders_cancel,
              })}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    );
  },
);

TwapOpenOrdersRow.displayName = 'TwapOpenOrdersRow';
export { TwapOpenOrdersRow };
