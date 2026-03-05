import { memo, useCallback, useMemo, useRef, useState } from 'react';

import {
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { truncatePerpsSubtitle } from './utils/perpsSubtitle';

const LeverageBadge = memo(({ leverage }: { leverage: number }) => (
  <XStack
    borderRadius="$1"
    bg="$bgInfo"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textInfo" lineHeight={16}>
      {leverage}x
    </SizableText>
  </XStack>
));
LeverageBadge.displayName = 'LeverageBadge';

const SubtitleBadge = memo(({ subtitle }: { subtitle: string }) => {
  const normalizedSubtitle = truncatePerpsSubtitle(subtitle);
  const isTruncated = normalizedSubtitle !== subtitle;
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const openByLongPressRef = useRef(false);

  const badgeElement = useMemo(
    () => (
      <XStack
        borderRadius="$1"
        bg="$bgStrong"
        justifyContent="center"
        alignItems="center"
        px="$1.5"
        minWidth={0}
        maxWidth="$28"
        flexShrink={1}
        overflow="hidden"
      >
        <SizableText
          fontSize={10}
          color="$textSubdued"
          lineHeight={16}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {normalizedSubtitle}
        </SizableText>
      </XStack>
    ),
    [normalizedSubtitle],
  );

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsPopoverOpen(false);
      openByLongPressRef.current = false;
      return;
    }

    if (openByLongPressRef.current) {
      setIsPopoverOpen(true);
      openByLongPressRef.current = false;
    }
  }, []);

  const handleBadgeLongPress = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
      openByLongPressRef.current = true;
      setIsPopoverOpen(true);
    },
    [],
  );

  const handleBadgePress = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
    },
    [],
  );

  if (!isTruncated) {
    return badgeElement;
  }

  if (!platformEnv.isNative) {
    return (
      <Tooltip
        renderTrigger={badgeElement}
        renderContent={subtitle}
        placement="top"
      />
    );
  }

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={handlePopoverOpenChange}
      usingSheet={false}
      showHeader={false}
      title=""
      placement="top"
      floatingPanelProps={{ width: 'auto' }}
      renderTrigger={
        <Stack onPress={handleBadgePress} onLongPress={handleBadgeLongPress}>
          {badgeElement}
        </Stack>
      }
      renderContent={
        <YStack px="$3" py="$2">
          <SizableText size="$bodySm" color="$text">
            {subtitle}
          </SizableText>
        </YStack>
      }
    />
  );
});
SubtitleBadge.displayName = 'SubtitleBadge';

export { LeverageBadge, SubtitleBadge };
