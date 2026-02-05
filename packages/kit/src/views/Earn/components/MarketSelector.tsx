import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IEarnHomeMode = 'earn' | 'borrow';

const MarketSelectorDesktop = ({
  mode,
  onModeChange,
  backgroundColor,
  activeBackgroundColor,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
  backgroundColor?: ISegmentControlProps['slotBackgroundColor'];
  activeBackgroundColor?: ISegmentControlProps['activeBackgroundColor'];
}) => {
  const intl = useIntl();

  const options = useMemo(() => {
    const renderLabel = (
      value: IEarnHomeMode,
      messageId: ETranslations,
      withBadge = false,
    ) => {
      const labelText = (
        <SizableText
          size="$headingMd"
          textAlign="center"
          color={mode === value ? '$textText' : '$textSubdued'}
        >
          {intl.formatMessage({ id: messageId })}
        </SizableText>
      );
      if (!withBadge) {
        return labelText;
      }
      return (
        <XStack alignItems="center" justifyContent="center" gap="$2">
          {labelText}
          <Badge badgeSize="sm" badgeType="success" pointerEvents="none">
            <Badge.Text>
              {intl.formatMessage({ id: ETranslations.explore_badge_new })}
            </Badge.Text>
          </Badge>
        </XStack>
      );
    };
    return [
      {
        label: renderLabel('earn', ETranslations.earn_title),
        value: 'earn' as const,
      },
      {
        label: renderLabel('borrow', ETranslations.global_borrow, true),
        value: 'borrow' as const,
      },
    ];
  }, [intl, mode]);

  const itemStyleProps = useMemo(() => {
    const baseProps = {
      elevation: 0,
      flexGrow: 1,
      flexBasis: 0,
      '$platform-native': {
        elevation: 0,
      },
      '$platform-web': {
        boxShadow: 'none',
      },
    };

    if (!backgroundColor) {
      return baseProps;
    }

    return {
      ...baseProps,
      hoverStyle: {
        bg: backgroundColor,
      },
      pressStyle: {
        bg: backgroundColor,
      },
    };
  }, [backgroundColor]);

  return (
    <Stack px="$pagePadding" pt="$5" pb="$1">
      <SegmentControl
        value={mode}
        options={options}
        width={264}
        onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        slotBackgroundColor={backgroundColor}
        activeBackgroundColor={activeBackgroundColor}
        segmentControlItemStyleProps={itemStyleProps}
      />
    </Stack>
  );
};

const MarketSelectorMobile = ({
  mode,
  onModeChange,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
}) => {
  const intl = useIntl();
  const options = useMemo(() => {
    const renderLabel = (
      value: IEarnHomeMode,
      messageId: ETranslations,
      withBadge = false,
    ) => {
      const isActive = mode === value;
      return (
        <YStack
          w="100%"
          alignItems="center"
          justifyContent="center"
          pt="$1"
          pb="$2"
          position="relative"
        >
          <XStack alignItems="center" justifyContent="center" gap="$2">
            <SizableText
              size="$headingMd"
              textAlign="center"
              color={isActive ? '$textText' : '$textSubdued'}
            >
              {intl.formatMessage({ id: messageId })}
            </SizableText>
            {withBadge ? (
              <Badge badgeSize="sm" badgeType="success" pointerEvents="none">
                <Badge.Text>
                  {intl.formatMessage({ id: ETranslations.explore_badge_new })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          {isActive ? (
            <YStack
              position="absolute"
              bottom={0}
              left="$5"
              right="$5"
              h="$0.5"
              bg="$text"
              borderRadius={1}
            />
          ) : null}
        </YStack>
      );
    };
    return [
      {
        label: renderLabel('earn', ETranslations.earn_title),
        value: 'earn' as const,
      },
      {
        label: renderLabel('borrow', ETranslations.global_borrow, true),
        value: 'borrow' as const,
      },
    ];
  }, [intl, mode]);

  return (
    <Stack px="$3" pt="$4">
      <SegmentControl
        value={mode}
        options={options}
        fullWidth
        onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        slotBackgroundColor="$transparent"
        activeBackgroundColor="$transparent"
        borderRadius="$0"
        p="$0"
        segmentControlItemStyleProps={{
          borderRadius: 0,
          px: '$0',
          py: '$0',
          elevation: 0,
          hoverStyle: {
            bg: '$transparent',
          },
          pressStyle: {
            bg: '$transparent',
          },
          '$platform-native': {
            elevation: 0,
          },
          '$platform-web': {
            boxShadow: 'none',
          },
        }}
      />
    </Stack>
  );
};

export const MarketSelector = ({
  mode,
  onModeChange,
  backgroundColor,
  activeBackgroundColor,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
  backgroundColor?: ISegmentControlProps['slotBackgroundColor'];
  activeBackgroundColor?: ISegmentControlProps['activeBackgroundColor'];
}) => {
  const { gtMd } = useMedia();

  if (gtMd) {
    return (
      <MarketSelectorDesktop
        mode={mode}
        onModeChange={onModeChange}
        backgroundColor={backgroundColor}
        activeBackgroundColor={activeBackgroundColor}
      />
    );
  }

  return <MarketSelectorMobile mode={mode} onModeChange={onModeChange} />;
};
