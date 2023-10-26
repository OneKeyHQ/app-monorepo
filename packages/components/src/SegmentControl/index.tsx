import { useCallback } from 'react';

import { styled } from 'tamagui';

import { Button } from '../Button';
import { XStack } from '../Stack';

import type { ViewStyle } from 'react-native';

interface SegmentControlProps {
  style?: ViewStyle;
  fullWidth?: boolean;
  value: string | number;
  options: {
    label: string;
    value: string | number;
  }[];
  onChange: (value: string | number) => void;
}

function SegmentControlItem({
  label,
  value,
  onChange,
  active,
}: {
  label: string;
  value: string | number;
  active: boolean;
  onChange: (value: string | number) => void;
}) {
  const handleChange = useCallback(() => {
    onChange(value);
  }, [onChange, value]);
  return (
    <Button
      padding="$0"
      paddingHorizontal="$0.5"
      size="small"
      variant={active ? 'primary' : 'tertiary'}
      onPress={handleChange}
      marginHorizontal="$1"
      pressStyle={{
        bg: active ? '$bg' : undefined,
      }}
      focusStyle={{
        bg: active ? '$bg' : undefined,
      }}
      hoverStyle={{
        bg: active ? '$bg' : undefined,
      }}
      color="$text"
      backgroundColor={active ? '$bg' : undefined}
    >
      {label}
    </Button>
  );
}

function SegmentControlFrame({
  value,
  options,
  onChange,
  fullWidth,
  style,
}: SegmentControlProps) {
  const handleChange = useCallback(
    (v: string | number) => {
      onChange(v);
    },
    [onChange],
  );
  return (
    <XStack
      width={fullWidth ? '100%' : 'auto'}
      justifyContent={fullWidth ? 'space-between' : undefined}
      alignSelf={fullWidth ? undefined : 'flex-start'}
      backgroundColor="$neutral5"
      borderRadius="$3"
      paddingVertical="$1"
      style={style}
    >
      {options.map(({ label, value: v }) => (
        <SegmentControlItem
          label={label}
          value={v}
          active={value === v}
          onChange={handleChange}
        />
      ))}
    </XStack>
  );
}

export const SegmentControl = styled(SegmentControlFrame, {});
