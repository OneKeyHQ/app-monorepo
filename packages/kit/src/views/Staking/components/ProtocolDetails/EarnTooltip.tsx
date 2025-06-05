import { useCallback, useMemo } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import type {
  IEarnHistoryActionIcon,
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
