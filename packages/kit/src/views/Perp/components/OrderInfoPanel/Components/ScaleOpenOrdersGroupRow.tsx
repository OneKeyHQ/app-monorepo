import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { getScaleOrderGroupFilledSize } from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IScaleOrderGroup } from '@onekeyhq/shared/types/hyperliquid/types';

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

interface IScaleOpenOrdersGroupRowProps {
  group: IScaleOrderGroup;
  childOrders: IPerpsFrontendOrder[];
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onCancelGroup: () => void;
}

const ScaleOpenOrdersGroupRow = memo(
  ({
    group,
    childOrders,
    cellMinWidth,
    columnConfigs,
    isMobile,
    index,
    renderMode = 'full',
    isHovered,
    onHoverChange,
    expanded,
    onToggleExpand,
    onCancelGroup,
  }: IScaleOpenOrdersGroupRowProps) => {
    const intl = useIntl();
    const assetSymbol = useMemo(
      () => parseDexCoin(group.coin).displayName,
      [group.coin],
    );
    const dateInfo = useMemo(() => {
      const timeDate = new Date(group.createdAt);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const time = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time };
    }, [group.createdAt]);

    const baseInfo = useMemo(() => {
      const lower = new BigNumber(group.lowerPrice);
      const upper = new BigNumber(group.upperPrice);
      const minPrice = BigNumber.min(lower, upper);
      const maxPrice = BigNumber.max(lower, upper);
      const openSize = childOrders.reduce(
        (sum, order) => sum.plus(order.sz),
        new BigNumber(0),
      );
      const openValue = childOrders.reduce(
        (sum, order) =>
          sum.plus(new BigNumber(order.sz).multipliedBy(order.limitPx)),
        new BigNumber(0),
      );
      const filledSize = getScaleOrderGroupFilledSize(group);
      const filledCount = group.children.filter((child) => {
        if (child.status === 'filled') {
          return true;
        }
        return new BigNumber(child.filledSize ?? 0).gt(0);
      }).length;
      const errorCount = group.children.filter(
        (child) => child.status === 'error',
      ).length;
      const canceledCount = group.children.filter(
        (child) => child.status === 'canceled',
      ).length;
      let status: string = group.status;
      if (filledCount > 0) {
        status = `${filledCount}/${group.children.length} filled`;
      } else if (errorCount > 0) {
        status = `${errorCount}/${group.children.length} failed`;
      } else if (canceledCount > 0) {
        status = `${canceledCount}/${group.children.length} canceled`;
      }
      return {
        openSizeFormatted: numberFormat(openSize.toFixed(), balanceFormatter),
        totalSizeFormatted: numberFormat(group.totalSize, balanceFormatter),
        openValueFormatted: numberFormat(openValue.toFixed(), valueFormatter),
        rangeFormatted: `$${minPrice.toFixed()} - $${maxPrice.toFixed()}`,
        progress: `${childOrders.length}/${group.children.length} open`,
        status,
        filledSizeFormatted: numberFormat(filledSize, balanceFormatter),
      };
    }, [childOrders, group]);

    const isOddRow = index % 2 === 1;
    const baseBgColor = isOddRow ? '$bgSubdued' : '$bgApp';
    const bgColor = isHovered ? '$bgHover' : baseBgColor;
    const typeColor = group.isBuy ? '$green11' : '$red11';
    const sideText = group.isBuy
      ? intl.formatMessage({ id: ETranslations.perp_long })
      : intl.formatMessage({ id: ETranslations.perp_short });

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
          onPress={onToggleExpand}
        >
          <XStack
            justifyContent="space-between"
            width="100%"
            alignItems="center"
          >
            <XStack gap="$2" alignItems="center" flex={1}>
              <Icon
                name={
                  expanded
                    ? 'ChevronDownSmallOutline'
                    : 'ChevronRightSmallOutline'
                }
                color="$iconSubdued"
                size="$4"
              />
              <YStack flex={1}>
                <SizableText size="$bodyMdMedium">
                  {assetSymbol} · Scale
                </SizableText>
                <SizableText size="$bodySm" color={typeColor}>
                  {`${sideText} · ${baseInfo.progress}`}
                </SizableText>
              </YStack>
            </XStack>
            <Button
              testID={PerpTestIDs.CancelOrderButton(group.createdAt)}
              size="small"
              variant="secondary"
              onPress={onCancelGroup}
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
              Range
            </SizableText>
            <SizableText size="$bodySm">{baseInfo.rangeFormatted}</SizableText>
          </XStack>
          <XStack width="100%" justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              Filled
            </SizableText>
            <SizableText size="$bodySm">
              {baseInfo.filledSizeFormatted} / {baseInfo.totalSizeFormatted}
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
              onPress={onToggleExpand}
              cursor="default"
            >
              <XStack gap="$1" alignItems="center">
                <Icon
                  name={
                    expanded
                      ? 'ChevronDownSmallOutline'
                      : 'ChevronRightSmallOutline'
                  }
                  color="$iconSubdued"
                  size="$4"
                />
                <SizableText size="$bodySm" fontWeight={600} color={typeColor}>
                  {assetSymbol}
                </SizableText>
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                Scale
              </SizableText>
            </YStack>
            <XStack
              {...getColumnStyle(columnConfigs[2])}
              justifyContent={calcCellAlign(columnConfigs[2].align)}
              alignItems="center"
              onPress={onToggleExpand}
              cursor="default"
            >
              <YStack>
                <SizableText size="$bodySm" color={typeColor}>
                  {`Scale / ${sideText}`}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {baseInfo.progress}
                </SizableText>
              </YStack>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[3])}
              justifyContent={calcCellAlign(columnConfigs[3].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {baseInfo.openSizeFormatted}
              </SizableText>
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
                {baseInfo.openValueFormatted}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[6])}
              justifyContent={calcCellAlign(columnConfigs[6].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {baseInfo.rangeFormatted}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[7])}
              justifyContent={calcCellAlign(columnConfigs[7].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">
                {group.reduceOnly ? 'Yes' : 'No'}
              </SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[8])}
              justifyContent={calcCellAlign(columnConfigs[8].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">{baseInfo.progress}</SizableText>
            </XStack>
            <XStack
              {...getColumnStyle(columnConfigs[9])}
              justifyContent={calcCellAlign(columnConfigs[9].align)}
              alignItems="center"
            >
              <SizableText size="$bodySm">{baseInfo.status}</SizableText>
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
              onPress={onCancelGroup}
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

ScaleOpenOrdersGroupRow.displayName = 'ScaleOpenOrdersGroupRow';
export { ScaleOpenOrdersGroupRow };
