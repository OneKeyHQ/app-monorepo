import { useCallback, useRef } from 'react';

import { ToggleGroup } from 'tamagui';

import type { IStackStyle } from '../Stack';
import type { ToggleGroupSingleProps } from 'tamagui';

export interface IButtonGroup {
  orientation?: ToggleGroupSingleProps['orientation'];
  disabled?: ToggleGroupSingleProps['disabled'];
  items: {
    onPress?: () => void;
    element: JSX.Element;
    containerProps?: IStackStyle;
  }[];
}

const ACTIVE_STYLE = {
  bg: '$bgStrongActive',
  borderWidth: 0,
  borderColor: '$borderColor',
};
export function ButtonGroup({
  disabled,
  orientation = 'horizontal',
  items = [],
}: IButtonGroup) {
  const prevValue = useRef<undefined | string>();
  const handleValueChange = useCallback(
    // Bug:
    // clicking the same button twice consecutively will result in the value becoming an empty string
    //  on the native platform.
    (value: string) => {
      if (disabled) {
        return;
      }
      items[Number(value !== '' ? value : prevValue.current)].onPress?.();
      if (value !== '') {
        prevValue.current = value;
      }
    },
    [disabled, items],
  );
  return (
    <ToggleGroup
      type="single"
      disabled={disabled}
      orientation={orientation}
      value={undefined}
      onValueChange={handleValueChange}
    >
      {items.map(({ element, containerProps }, index) => (
        <ToggleGroup.Item
          borderWidth={0}
          m={0}
          minWidth={42}
          height={38}
          bg="$bgStrong"
          hoverStyle={ACTIVE_STYLE}
          pressStyle={ACTIVE_STYLE}
          focusStyle={ACTIVE_STYLE}
          value={String(index)}
          key={index}
          {...containerProps}
        >
          {element}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
}
