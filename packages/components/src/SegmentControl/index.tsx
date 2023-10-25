import { useCallback } from 'react';

import { Button } from '../Button';
import { XStack } from '../Stack';

interface SegmentControlProps {
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
    >
      {label}
    </Button>
  );
}

export function SegmentControl({
  value,
  options,
  onChange,
}: SegmentControlProps) {
  const handleChange = useCallback(
    (v: string | number) => {
      onChange(v);
    },
    [onChange],
  );
  return (
    <XStack
      width="auto"
      alignSelf="flex-start"
      backgroundColor="$neutral5"
      borderRadius="$3"
      paddingVertical="$1"
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
