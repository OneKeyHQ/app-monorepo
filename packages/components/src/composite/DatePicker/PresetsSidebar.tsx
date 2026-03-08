import { memo, useCallback, useMemo } from 'react';

import { SizableText, Stack, YStack } from '../../primitives';

import type { IDateRange, IDateRangePreset } from './type';

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function PresetItem({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Stack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$2"
      cursor="pointer"
      backgroundColor={isActive ? '$bgActive' : 'transparent'}
      hoverStyle={{ backgroundColor: isActive ? '$bgActive' : '$bgHover' }}
      pressStyle={{ backgroundColor: '$bgActive' }}
      onPress={onPress}
    >
      <SizableText
        size="$bodyMd"
        color={isActive ? '$text' : '$textSubdued'}
        userSelect="none"
      >
        {label}
      </SizableText>
    </Stack>
  );
}

export const PresetsSidebar = memo(
  ({
    presets,
    value,
    onSelect,
  }: {
    presets: IDateRangePreset[];
    value?: IDateRange;
    onSelect: (range: IDateRange) => void;
  }) => {
    const activeIndex = useMemo(() => {
      if (!value?.start || !value?.end) return -1;
      return presets.findIndex((preset) => {
        const range = preset.getRange();
        return (
          isSameDay(range.start, value.start) && isSameDay(range.end, value.end)
        );
      });
    }, [presets, value]);

    const handlePress = useCallback(
      (preset: IDateRangePreset) => {
        onSelect(preset.getRange());
      },
      [onSelect],
    );

    return (
      <YStack
        width={156}
        borderRightWidth={1}
        borderRightColor="$neutral3"
        paddingVertical="$1"
        paddingHorizontal="$1"
        gap="$0.5"
      >
        {presets.map((preset, index) => (
          <PresetItem
            key={preset.label}
            label={preset.label}
            isActive={index === activeIndex}
            onPress={() => handlePress(preset)}
          />
        ))}
      </YStack>
    );
  },
);

PresetsSidebar.displayName = 'PresetsSidebar';
