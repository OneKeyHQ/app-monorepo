import { ButtonFrame, SizableText, Stack, YStack } from '@onekeyhq/components';

import { MarketTestIDs } from '../../../testIDs';

import type { ITimeRangeOption, ITimeRangeSelectorProps } from '../types';

// Figma: the active segment carries a 0 2px 3px rgba(0, 0, 0, 0.09) drop shadow.
const ACTIVE_SEGMENT_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 3,
} as const;

const REDESIGN_ACTIVE_STYLE = { bg: '$bg' } as const;
const REDESIGN_INACTIVE_HOVER_STYLE = { bg: '$bgHover' } as const;
const REDESIGN_INACTIVE_PRESS_STYLE = { bg: '$bgActive' } as const;
const LEGACY_ACTIVE_HOVER_STYLE = { bg: '$bgAppHover' } as const;
const LEGACY_ACTIVE_PRESS_STYLE = { bg: '$bgAppActive' } as const;
const LEGACY_INACTIVE_HOVER_STYLE = { bg: '$bgHover' } as const;
const LEGACY_INACTIVE_PRESS_STYLE = { bg: '$bgActive' } as const;

function getPercentageColor(option: ITimeRangeOption) {
  if (option.isZero) {
    return '$textSubdued';
  }
  return option.isPositive ? '$textSuccess' : '$textCritical';
}

function getSegmentFrameProps(isActive: boolean, desktopRedesign: boolean) {
  if (desktopRedesign) {
    return {
      bg: isActive ? ('$bg' as const) : ('$transparent' as const),
      hoverStyle: isActive
        ? REDESIGN_ACTIVE_STYLE
        : REDESIGN_INACTIVE_HOVER_STYLE,
      pressStyle: isActive
        ? REDESIGN_ACTIVE_STYLE
        : REDESIGN_INACTIVE_PRESS_STYLE,
    };
  }
  return {
    bg: isActive ? ('$bgApp' as const) : ('$transparent' as const),
    hoverStyle: isActive
      ? LEGACY_ACTIVE_HOVER_STYLE
      : LEGACY_INACTIVE_HOVER_STYLE,
    pressStyle: isActive
      ? LEGACY_ACTIVE_PRESS_STYLE
      : LEGACY_INACTIVE_PRESS_STYLE,
  };
}

export function TimeRangeSelector({
  options,
  value,
  onChange,
  isLoading,
  desktopRedesign = false,
}: ITimeRangeSelectorProps) {
  return (
    <Stack
      flexDirection="row"
      justifyContent="space-between"
      gap={desktopRedesign ? '$0.5' : '$1'}
      bg={desktopRedesign ? '$bgStrong' : '$neutral5'}
      p="$0.5"
      borderRadius="$2.5"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <ButtonFrame
            key={opt.value}
            testID={MarketTestIDs.chartTimeRange(opt.value)}
            flex={1}
            borderWidth={0}
            borderRadius="$2"
            py="$1"
            onPress={() => onChange(opt.value)}
            {...getSegmentFrameProps(isActive, desktopRedesign)}
            {...(desktopRedesign && isActive && ACTIVE_SEGMENT_SHADOW)}
          >
            <YStack alignItems="center">
              <SizableText
                size="$bodyMd"
                color={isActive || desktopRedesign ? '$text' : '$textSubdued'}
                fontWeight={desktopRedesign ? undefined : '500'}
              >
                {desktopRedesign ? opt.label.toLowerCase() : opt.label}
              </SizableText>
              <SizableText
                size="$bodySm"
                color={isLoading ? '$textSubdued' : getPercentageColor(opt)}
              >
                {isLoading ? '--' : opt.percentageChange}
              </SizableText>
            </YStack>
          </ButtonFrame>
        );
      })}
    </Stack>
  );
}
