import { useCallback, useMemo } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type {
  IEarnHistoryActionIcon,
  IEarnRebateTooltip,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

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
        <SizableText
          size={tooltip?.data.title.size || '$bodyLgMedium'}
          color={tooltip?.data.title.color}
        >
          {tooltip?.data.description.text}
        </SizableText>
      </XStack>
      <XStack pt="$2">
        <SizableText
          size={tooltip?.data.text.size || '$bodySm'}
          color={tooltip?.data.text.color || '$textSubdued'}
        >
          {tooltip?.data.text.text}
        </SizableText>
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
            <FormatHyperlinkText
              size={item?.title?.size || '$bodyMdMedium'}
              color={item?.title?.color}
            >
              {item?.title?.text}
            </FormatHyperlinkText>
            {isHistoryButton ? (
              <XStack gap="$0.5" cursor="pointer">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {button?.text.text}
                </SizableText>
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
              <FormatHyperlinkText
                size={item.title.size || '$bodyLgMedium'}
                color={item.title.color}
              >
                {item.title.text}
              </FormatHyperlinkText>
              <FormatHyperlinkText
                size={item.title.size || '$bodyLgMedium'}
                color={item.title.color}
              >
                {item.description.text}
              </FormatHyperlinkText>
            </XStack>
          ))}
          {tooltip.data.description ? (
            <FormatHyperlinkText size="$bodySm" color="$textSubdued">
              {tooltip.data.description}
            </FormatHyperlinkText>
          ) : null}
        </YStack>
      );
    }
    if (tooltip.type === 'rebate') {
      return (
        <RewardAmountPopoverContent tooltip={tooltip} onHistory={onHistory} />
      );
    }
    return (
      <FormatHyperlinkText size={tooltip.data.size} color={tooltip.data.color}>
        {tooltip.data.text}
      </FormatHyperlinkText>
    );
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
