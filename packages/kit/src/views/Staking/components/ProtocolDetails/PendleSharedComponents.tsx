import type { FC, ReactElement, ReactNode } from 'react';
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
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import type {
  IEarnText,
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { EarnFormRow, buildRowKeys } from '../UniversalStake/EarnFormSummary';

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
    <YStack
      transition="quick"
      animateOnly={ANIMATE_ONLY_TRANSFORM}
      rotate={open && !isDisabled ? '180deg' : '0deg'}
    >
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
  placeholder,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  amountValue: string;
  isPendleLikeLayout: boolean;
  // No amount: the last quote's rows, each value a dash
  placeholder?: boolean;
}): ReactElement[] {
  return useMemo(() => {
    const items: ReactElement[] = [];
    if (!isPendleLikeLayout || (!placeholder && Number(amountValue) <= 0)) {
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

    // The form's rows, keyed by label: a row holding its place and the same
    // row with its figure are one row
    const rowKeys = buildRowKeys(
      detailItems.map((detailItem) => detailItem.title.text),
    );
    detailItems.forEach((detailItem, index) => {
      const popupButton =
        detailItem.button?.type === 'popup' ? detailItem.button : undefined;
      // A dash, or a placeholder while the amount's quote is coming
      let value: ReactNode;
      if (placeholder) {
        value = undefined;
      } else if (popupButton) {
        value = (
          <Popover
            title={popupButton.data.title?.text ?? ''}
            renderTrigger={
              <XStack gap="$1" ai="center" cursor="pointer">
                <EarnText text={detailItem.description} size="$bodyMdMedium" />
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
      } else if (detailItem.description?.text) {
        value = (
          <EarnText
            text={detailItem.description}
            size="$bodyMdMedium"
            textAlign="right"
          />
        );
      } else {
        // Before and after; one value when they are the same
        const isUnchanged =
          detailItem.current?.title?.text?.trim() ===
          detailItem.latest?.title?.text?.trim();
        const before = isUnchanged ? undefined : detailItem.current?.title;
        value = (
          <XStack alignItems="center" gap="$1.5" flexShrink={1}>
            {before ? (
              <EarnText
                text={before}
                size="$bodySm"
                color={before.color ?? '$textSubdued'}
              />
            ) : null}
            {before && detailItem.latest?.title ? (
              <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
            ) : null}
            {detailItem.latest?.title ? (
              <EarnText text={detailItem.latest.title} size="$bodyMdMedium" />
            ) : null}
          </XStack>
        );
      }
      // The same row as every other in the form: label (its (i) opens the
      // same way as theirs) and value
      items.push(
        <EarnFormRow
          key={rowKeys[index]}
          label={detailItem.title.text}
          tooltip={detailItem.tooltip}
          value={value}
        />,
      );
    });

    if (swapRouteItems.length > 0) {
      if (detailItems.length > 0) {
        items.push(<Divider key="swap-route-divider" />);
      }
      items.push(
        <EarnSwapRoute
          key="swap-route"
          routes={swapRouteItems}
          isPlaceholder={placeholder}
        />,
      );
    }

    return items;
  }, [amountValue, isPendleLikeLayout, placeholder, transactionConfirmation]);
}
