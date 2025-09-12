import { useCallback, useMemo } from 'react';

import {
  Divider,
  Icon,
  IconButton,
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
  IEarnHistoryActionIcon,
  IEarnRebateDetailsTooltip,
  IEarnRebateTooltip,
  IEarnTooltip,
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

export function EarnTooltip({
  title,
  tooltip,
}: {
  title?: string;
  tooltip?: IEarnTooltip;
}) {
  const { onHistory } = useShareEvents();

  const tooltipTitle = useMemo(() => {
    if (tooltip?.type === 'withdraw') {
      return tooltip.data.title;
    }
    if (tooltip?.type === 'rebateDetails') {
      return tooltip.data.title.text;
    }
    return title || '';
  }, [tooltip, title]);
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
              text={{ text: tooltip.data.description }}
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

    return <EarnText text={tooltip.data} />;
  }, [onHistory, tooltip]);
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
