import type { FC, ReactElement } from 'react';
import { useMemo } from 'react';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IEarnText,
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { CalculationListItem } from '../CalculationList';

import { ActionPopupContent } from './EarnActionIcon';
import { EarnAmountText } from './EarnAmountText';
import { EarnSwapRoute } from './EarnSwapRoute';
import { EarnText } from './EarnText';
import { EarnTooltip } from './EarnTooltip';

// --- PendleRewardRow ---

type IPendleRewardRowProps = {
  reward: {
    title: IEarnText;
    description: IEarnText;
    tooltip?: IEarnTooltip;
  };
  loading?: boolean;
};

export const PendleRewardRow: FC<IPendleRewardRowProps> = ({
  reward,
  loading,
}) => {
  const descriptionLines = reward.description.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const primaryDescriptionText = descriptionLines[0];
  const secondaryDescriptionText = descriptionLines[1];
  const primaryWithSuffixMatch = primaryDescriptionText?.match(
    /^(.*?)(\s*\([^()]*\))$/,
  );
  const primaryMainText =
    primaryWithSuffixMatch?.[1]?.trim() || primaryDescriptionText;
  const primarySuffixText = primaryWithSuffixMatch?.[2]?.trim();

  if (!primaryMainText) {
    return null;
  }

  return (
    <XStack gap="$3" alignItems="flex-start" justifyContent="space-between">
      <XStack gap="$1.5" flex={1} alignItems="center" minWidth={0}>
        <EarnText
          text={reward.title}
          color={reward.title.color ?? '$textSubdued'}
          size={reward.title.size || '$bodyMd'}
          flexShrink={1}
        />
        <EarnTooltip title={reward.title.text} tooltip={reward.tooltip} />
      </XStack>
      <YStack gap="$0.5" alignItems="flex-end" flexShrink={1} maxWidth="65%">
        {loading ? (
          <Stack py="$0.5">
            <Skeleton h="$3.5" w="$16" />
          </Stack>
        ) : (
          <>
            <XStack
              gap="$1"
              alignItems="center"
              flexWrap="wrap"
              justifyContent="flex-end"
            >
              <EarnAmountText
                size={reward.description.size || '$bodyMdMedium'}
                color={reward.description.color ?? '$text'}
                textAlign="right"
              >
                {primaryMainText}
              </EarnAmountText>
              {primarySuffixText ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {primarySuffixText}
                </SizableText>
              ) : null}
            </XStack>
            {secondaryDescriptionText ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                textAlign="right"
              >
                {secondaryDescriptionText}
              </SizableText>
            ) : null}
          </>
        )}
      </YStack>
    </XStack>
  );
};

// --- PendleSummarySection ---

type IPendleSummarySectionProps = {
  rewardRows: Array<{
    title: IEarnText;
    description: IEarnText;
    tooltip?: IEarnTooltip;
  }>;
  tipText?: IEarnText;
  loading?: boolean;
};

const SKELETON_PLACEHOLDER_COUNT = 3;

export const PendleSummarySection: FC<IPendleSummarySectionProps> = ({
  rewardRows,
  tipText,
  loading,
}) => {
  const rowsContent = useMemo(() => {
    if (rewardRows.length > 0) {
      return rewardRows.map((reward, index) => (
        <PendleRewardRow
          key={`${reward.title.text}-${index}`}
          reward={reward}
          loading={loading}
        />
      ));
    }
    if (loading) {
      return Array.from({ length: SKELETON_PLACEHOLDER_COUNT }).map(
        (_, index) => (
          <XStack
            key={`skeleton-row-${index}`}
            gap="$3"
            alignItems="center"
            justifyContent="space-between"
          >
            <Skeleton h="$3.5" w="$20" />
            <Stack py="$0.5">
              <Skeleton h="$3.5" w="$16" />
            </Stack>
          </XStack>
        ),
      );
    }
    return null;
  }, [rewardRows, loading]);

  return (
    <YStack gap="$3.5">
      {rowsContent}
      {tipText ? (
        <EarnText
          text={tipText}
          size="$bodySm"
          color={tipText.color ?? '$textInfo'}
        />
      ) : null}
    </YStack>
  );
};

// --- PendleAccordionTriggerContent ---

type IPendleAccordionTriggerContentProps = {
  open: boolean;
  triggerText?: string;
  isDisabled: boolean;
};

export const PendleAccordionTriggerContent: FC<
  IPendleAccordionTriggerContentProps
> = ({ open, triggerText, isDisabled }) => (
  <>
    <SizableText
      size="$bodyMdMedium"
      color={isDisabled ? '$textDisabled' : '$text'}
    >
      {triggerText}
    </SizableText>
    <YStack animation="quick" rotate={open && !isDisabled ? '180deg' : '0deg'}>
      <Icon
        name="ChevronDownSmallSolid"
        color={isDisabled ? '$iconDisabled' : '$iconSubdued'}
        size="$5"
      />
    </YStack>
  </>
);

// --- usePendleTransactionDetails hook ---

export function usePendleTransactionDetails({
  transactionConfirmation,
  amountValue,
  isPendleLikeLayout,
  loading,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  amountValue: string;
  isPendleLikeLayout: boolean;
  loading?: boolean;
}): ReactElement[] {
  return useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0 || !isPendleLikeLayout) {
      return items;
    }

    const detailItems =
      transactionConfirmation?.transactionDetails?.data?.transactionDetails?.filter(
        (detailItem) =>
          !!detailItem?.title?.text &&
          (!!detailItem?.description?.text ||
            !!detailItem?.current?.title?.text ||
            !!detailItem?.latest?.title?.text),
      ) ?? [];
    const swapRouteItems =
      transactionConfirmation?.transactionDetails?.data?.swapRoute?.filter(
        (routeItem) =>
          !!routeItem?.token?.symbol && !!routeItem?.token?.logoURI,
      ) ?? [];
    const resolveTooltipText = (tooltip?: IEarnTooltip) => {
      if (tooltip?.type !== 'text') {
        return undefined;
      }
      return tooltip.data?.description?.text;
    };

    detailItems.forEach((detailItem, index) => {
      const hasRichTooltip =
        detailItem.tooltip &&
        (detailItem.tooltip.type !== 'text' ||
          detailItem.tooltip.data?.items?.length);
      const popupButton =
        detailItem.button?.type === 'popup' ? detailItem.button : undefined;

      items.push(
        <CalculationListItem key={`tx-detail-${index}`}>
          {hasRichTooltip ? (
            <XStack gap="$1" ai="center" flex={1}>
              <SizableText
                color={detailItem.title.color ?? '$textSubdued'}
                size={detailItem.title.size || '$bodyMd'}
              >
                {detailItem.title.text}
              </SizableText>
              <EarnTooltip
                title={detailItem.title.text}
                tooltip={detailItem.tooltip}
              />
            </XStack>
          ) : (
            <CalculationListItem.Label
              size={detailItem.title.size || '$bodyMd'}
              color={detailItem.title.color}
              tooltip={resolveTooltipText(detailItem.tooltip)}
            >
              {detailItem.title.text}
            </CalculationListItem.Label>
          )}
          {(() => {
            if (loading) {
              return (
                <Stack py="$0.5">
                  <Skeleton h="$3.5" w="$16" />
                </Stack>
              );
            }
            if (popupButton) {
              return (
                <Popover
                  title={popupButton.data.title?.text ?? ''}
                  renderTrigger={
                    <XStack gap="$1" ai="center" cursor="pointer">
                      <EarnText
                        text={detailItem.description}
                        size="$bodyMdMedium"
                      />
                      <Icon
                        name="ChevronRightSmallOutline"
                        size="$5"
                        color="$iconSubdued"
                      />
                    </XStack>
                  }
                  renderContent={
                    <ActionPopupContent
                      bulletList={popupButton.data.bulletList}
                      items={popupButton.data.items}
                      panel={popupButton.data.panel}
                      description={popupButton.data.description}
                    />
                  }
                />
              );
            }
            if (detailItem.description?.text) {
              return (
                <EarnText
                  text={detailItem.description}
                  size="$bodyMdMedium"
                  textAlign="right"
                />
              );
            }
            return (
              <XStack alignItems="center" gap="$1.5" flexShrink={1}>
                {detailItem.current?.title ? (
                  <EarnText
                    text={detailItem.current.title}
                    size="$bodySm"
                    color={detailItem.current.title.color ?? '$textSubdued'}
                  />
                ) : null}
                {detailItem.current?.title && detailItem.latest?.title ? (
                  <Icon
                    name="ArrowRightOutline"
                    size="$4"
                    color="$iconDisabled"
                  />
                ) : null}
                {detailItem.latest?.title ? (
                  <EarnText
                    text={detailItem.latest.title}
                    size="$bodyMdMedium"
                  />
                ) : null}
              </XStack>
            );
          })()}
        </CalculationListItem>,
      );
    });

    if (swapRouteItems.length > 0) {
      if (detailItems.length > 0) {
        items.push(<Divider key="swap-route-divider" />);
      }
      items.push(<EarnSwapRoute key="swap-route" routes={swapRouteItems} />);
    }

    return items;
  }, [amountValue, isPendleLikeLayout, loading, transactionConfirmation]);
}
