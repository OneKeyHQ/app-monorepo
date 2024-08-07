import { useCallback } from 'react';

import { ToggleGroup } from 'tamagui';

import type { ToggleGroupSingleProps } from 'tamagui';

export interface IButtonGroup {
  orientation?: ToggleGroupSingleProps['orientation'];
  disabled?: ToggleGroupSingleProps['disabled'];
  items: {
    onPress?: () => void;
    element: JSX.Element;
  }[];
}

export function ButtonGroup({
  disabled,
  orientation = 'horizontal',
  items = [],
}: IButtonGroup) {
  const handleValueChange = useCallback(
    (value: string) => {
      if (disabled) {
        return;
      }
      items[Number(value)].onPress?.();
    },
    [disabled, items],
  );
  return (
    <ToggleGroup
      type="single"
      disabled={disabled}
      orientation={orientation}
      value={undefined}
      bg="$bgStrong"
      onValueChange={handleValueChange}
    >
      {items.map(({ element }, index) => (
        <ToggleGroup.Item
          borderLeftWidth={index > 0 ? 0 : undefined}
          width={42}
          height={38}
          pressStyle={{
            borderLeftWidth: index > 0 ? 0 : undefined,
            borderColor: '$borderColor',
          }}
          focusStyle={{
            borderLeftWidth: index > 0 ? 0 : undefined,
            borderColor: '$borderColor',
          }}
          style={{ 'appearance': 'none' }}
          value={String(index)}
          key={index}
        >
          {element}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
}
