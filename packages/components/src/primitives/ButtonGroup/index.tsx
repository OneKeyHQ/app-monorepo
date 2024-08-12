import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo } from 'react';

import { ToggleGroup, withStaticProperties } from 'tamagui';

import type { ToggleGroupItemProps, ToggleGroupSingleProps } from 'tamagui';

export type IButtonGroup = PropsWithChildren<{
  orientation?: ToggleGroupSingleProps['orientation'];
  disabled?: ToggleGroupSingleProps['disabled'];
}>;

const ACTIVE_STYLE = {
  bg: '$bgStrongActive',
  borderWidth: 0,
  borderColor: '$borderColor',
};

const DISABLED_ACTIVE_STYLE = {
  bg: '$bgStrong',
  borderWidth: 0,
  borderColor: '$borderColor',
};

export interface IButtonGroupContext {
  disabled?: boolean;
}
const ButtonGroupContext = createContext({} as IButtonGroupContext);

export function ButtonGroupItem({
  disabled: propsDisabled,
  onPress,
  children,
  ...props
}: Omit<ToggleGroupItemProps, 'value'>) {
  const { disabled: contextDisabled } = useContext(ButtonGroupContext);
  const disabled = propsDisabled || contextDisabled;
  const style = disabled ? DISABLED_ACTIVE_STYLE : ACTIVE_STYLE;
  return (
    <ToggleGroup.Item
      borderWidth={0}
      m={0}
      minWidth={42}
      height={38}
      bg="$bgStrong"
      cursor={disabled ? 'not-allowed' : undefined}
      onPress={disabled ? undefined : onPress}
      opacity={disabled ? 0.5 : undefined}
      disabled={disabled}
      hoverStyle={style}
      pressStyle={style}
      focusStyle={style}
      value={Math.random().toString()}
      {...props}
    >
      {children}
    </ToggleGroup.Item>
  );
}

function BasicButtonGroup({
  disabled,
  orientation = 'horizontal',
  children,
}: IButtonGroup) {
  const contextValue = useMemo(
    () => ({
      disabled,
    }),
    [disabled],
  );
  return (
    <ButtonGroupContext.Provider value={contextValue}>
      <ToggleGroup
        type="single"
        disabled={disabled}
        orientation={orientation}
        value={undefined}
      >
        {children}
      </ToggleGroup>
    </ButtonGroupContext.Provider>
  );
}

export const ButtonGroup = withStaticProperties(BasicButtonGroup, {
  Item: ButtonGroupItem,
});
