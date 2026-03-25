import { useCallback, useMemo } from 'react';

import {
  Divider,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  IEarnFeeComparisonTooltip,
  IEarnHistoryActionIcon,
  IEarnRebateDetailsTooltip,
  IEarnRebateTooltip,
  IEarnTextTooltip,
  IEarnTooltip,
  IEarnTooltipComparisonItem,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';
import { useShareEvents } from './ShareEventsProvider';

function RewardAmountPopoverContent({
  tooltip,
  onHistory,
}: {
  tooltip?: IEarnRebateTooltip;
  onHistory?: (params?: { filterType?: string }) => void;
}) {
  const { closePopover } = usePopoverContext();
  const handleHistoryPress = useCallback(async () => {
    await closePopover?.();
    setTimeout(() => {
      onHistory?.({ filterType: 'rebate' });
    }, 50);
  }, [closePopover, onHistory]);
  return (
    <>
      <XStack>
        <EarnText text={tooltip?.data.title} size="$bodyLgMedium" />
      </XStack>
      <XStack pt="$2">
        <EarnText
          text={tooltip?.data.text}
          boldTextProps={{
            size: '$bodyMdMedium',
          }}
          size="$bodySm"
          color="$textSubdued"
        />
      </XStack>
      {tooltip?.data.items.map((item, index) => {
        const button = item.button as IEarnHistoryActionIcon;
        const isHistoryButton = button?.type === 'history' && !button?.disabled;
        return (
          <XStack
            key={index}
            jc="space-between"
            pt="$4"
            onPress={isHistoryButton ? handleHistoryPress : undefined}
          >
            <EarnText text={item?.title} size="$bodyMdMedium" />
            {isHistoryButton ? (
              <XStack gap="$0.5" cursor="pointer">
                <EarnText
                  text={button?.text}
                  size="$bodyMd"
                  color="$textSubdued"
                />
                <Icon
                  name="ChevronRightSmallOutline"
                  color="$iconSubdued"
                  size="$5"
                />
              </XStack>
            ) : null}
          </XStack>
        );
      })}
    </>
  );
}

function RebateDetailsPopoverContent({
  tooltip,
}: {
  tooltip?: IEarnRebateDetailsTooltip;
}) {
  return tooltip ? (
    <YStack borderRadius="$3" mb={-20} mx={-20} overflow="hidden">
      <YStack px="$5">
        {tooltip?.data.tokens?.map(
          ({ info: token, fiatValue, amount }, index) => {
            return (
              <XStack
                key={index}
                gap="$2"
                h={48}
                ai="center"
                jc="space-between"
                py={5}
              >
                <XStack gap="$2.5" ai="center">
                  <Token size="sm" tokenImageUri={token.logoURI} />
                  <SizableText size="$bodyMdMedium">
                    {token.symbol.toUpperCase()}
                  </SizableText>
                </XStack>
                <YStack ai="flex-end">
                  <NumberSizeableText formatter="balance" size="$bodyMdMedium">
                    {amount}
                  </NumberSizeableText>
                  <Currency
                    formatter="balance"
                    size="$bodySmMedium"
                    color="$textSubdued"
                  >
                    {fiatValue}
                  </Currency>
                </YStack>
              </XStack>
            );
          },
        )}
      </YStack>
      <YStack bg="$bgSubdued">
        <Divider />
        <XStack ai="center" gap="$2" py="$2.5" px="$5">
          <Stack>
            <Icon color="$iconSubdued" size="$5" name="InfoCircleOutline" />
          </Stack>
          <EarnText
            flex={1}
            size="$bodyMd"
            color="$textSubdued"
            text={tooltip.data.description}
          />
        </XStack>
      </YStack>
    </YStack>
  ) : null;
}

function FeeComparisonContent({
  tooltip,
}: {
  tooltip: IEarnTextTooltip | IEarnFeeComparisonTooltip;
}) {
  const items = tooltip.data.items ?? [];
  const totalValue = items.reduce((sum, item) => {
    const percentage = Number(item.logo?.percentage);
    if (Number.isFinite(percentage)) {
      return sum;
    }

    const value = Number(item.value);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const normalizedItems = items.map((item) => {
    const percentage = Number(item.logo?.percentage);
    const value = Number(item.value);
    let resolvedPercentage = 0;

    if (Number.isFinite(percentage)) {
      resolvedPercentage = percentage;
    } else if (totalValue > 0 && Number.isFinite(value)) {
      resolvedPercentage = value / totalValue;
    }

    return {
      ...item,
      barColor: item.logo?.color ?? item.color ?? '$bgStrong',
      barPercentage: Math.max(Math.min(resolvedPercentage * 100, 100), 0),
    };
  });

  return (
    <YStack gap="$2">
      <EarnText
        text={tooltip.data.description}
        size="$bodySm"
        color="$textSubdued"
      />
      <YStack gap="$2" pt="$2">
        {normalizedItems.map((item, index) => (
          <XStack key={index} gap="$3" ai="center">
            <Image
              src={item.logo?.logoURI ?? ''}
              w="$5"
              h="$5"
              borderRadius="$1"
            />
            <Stack flex={1}>
              <Stack
                h="$1"
                borderRadius="$full"
                bg={item.barColor}
                width={`${item.barPercentage}%`}
              />
            </Stack>
            <SizableText
              size="$bodySm"
              color={item.description.color ?? '$text'}
              w={64}
              textAlign="right"
            >
              {item.description.text}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export function EarnTooltip({
  title,
  tooltip,
}: {
  title?: string;
  tooltip?: IEarnTooltip;
}) {
  const { onHistory } = useShareEvents();
  const isTextLikeTooltip = useCallback(
    (
      value?: IEarnTooltip,
    ): value is IEarnTextTooltip | IEarnFeeComparisonTooltip =>
      value?.type === 'text' || value?.type === 'feeComparison',
    [],
  );
  const isFeeComparisonTooltip = useCallback(
    (value?: IEarnTooltip) => {
      if (!isTextLikeTooltip(value)) {
        return false;
      }

      if (value.type === 'feeComparison') {
        return true;
      }

      return Boolean(
        value.data.items?.some(
          (item: IEarnTooltipComparisonItem) =>
            item.logo || item.color || item.value,
        ),
      );
    },
    [isTextLikeTooltip],
  );

  const tooltipTitle = useMemo(() => {
    if (tooltip?.type === 'withdraw') {
      return tooltip.data.title.text;
    }
    if (tooltip?.type === 'rebateDetails') {
      return tooltip.data.title.text;
    }
    if (isTextLikeTooltip(tooltip) && tooltip?.data?.title?.text) {
      return tooltip.data.title.text;
    }

    return title || '';
  }, [isTextLikeTooltip, title, tooltip]);
  const tooltipContent = useMemo(() => {
    if (!tooltip) {
      return null;
    }
    if (tooltip.type === 'withdraw') {
      return (
        <YStack gap="$4">
          {tooltip.data.items.map((item, index) => (
            <XStack jc="space-between" key={index}>
              <EarnText text={item.title} size="$bodyLgMedium" />
              <EarnText text={item.description} size="$bodyLgMedium" />
            </XStack>
          ))}
          {tooltip.data.description ? (
            <EarnText
              text={tooltip.data.description}
              size="$bodySm"
              color="$textSubdued"
              boldTextProps={{
                size: '$bodyMdMedium',
              }}
            />
          ) : null}
        </YStack>
      );
    }
    if (tooltip.type === 'rebate') {
      return (
        <RewardAmountPopoverContent tooltip={tooltip} onHistory={onHistory} />
      );
    }

    if (tooltip.type === 'rebateDetails') {
      return <RebateDetailsPopoverContent tooltip={tooltip} />;
    }

    if (isTextLikeTooltip(tooltip) && tooltip.data.items?.length) {
      if (isFeeComparisonTooltip(tooltip)) {
        return <FeeComparisonContent tooltip={tooltip} />;
      }
      return (
        <YStack gap="$2">
          <EarnText text={tooltip.data.description} />
          {tooltip.data.items.map((item, index) => (
            <XStack jc="space-between" key={index}>
              <EarnText text={item.title} size="$bodyMd" color="$textSubdued" />
              <EarnText text={item.description} size="$bodyMdMedium" />
            </XStack>
          ))}
        </YStack>
      );
    }

    return isTextLikeTooltip(tooltip) ? (
      <EarnText text={tooltip.data.description} />
    ) : null;
  }, [isFeeComparisonTooltip, isTextLikeTooltip, onHistory, tooltip]);
  return tooltip ? (
    <Popover
      placement="top"
      title={tooltipTitle}
      renderTrigger={
        <IconButton
          iconColor="$iconSubdued"
          size="small"
          icon="InfoCircleOutline"
          variant="tertiary"
        />
      }
      renderContent={<Stack p="$5">{tooltipContent}</Stack>}
    />
  ) : null;
}
