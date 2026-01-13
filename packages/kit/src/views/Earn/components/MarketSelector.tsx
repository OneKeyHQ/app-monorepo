import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IEarnHomeMode = 'earn' | 'borrow';

export const MarketSelector = ({
  mode,
  onModeChange,
  backgroundColor = '$bg',
  activeBackgroundColor = '$bg',
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

  return (
    <Stack px="$3" pt="$4">
      <SegmentControl
        value={mode}
        options={options}
        onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        slotBackgroundColor={backgroundColor}
        activeBackgroundColor={activeBackgroundColor}
        segmentControlItemStyleProps={{
          elevation: 0,
          hoverStyle: {
            bg: backgroundColor,
          },
          pressStyle: {
            bg: backgroundColor,
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
