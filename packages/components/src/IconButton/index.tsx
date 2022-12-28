import type { ComponentProps } from 'react';
import { forwardRef } from 'react';

import Button from '../Button';

import type { ButtonSize, ButtonType } from '../Button';
import type { ICON_NAMES } from '../Icon';

type IconButtonProps = {
  name: ICON_NAMES;
  type?: ButtonType;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  circle?: boolean;
};

function getRect(size: ButtonSize = 'base') {
  const paddingMap: Record<ButtonSize, number> = {
    'base': 2,
    'xs': 1,
    'sm': 1.5,
    'lg': 2,
    'xl': 3,
  };
  return paddingMap[size];
}

function getIconSize(size: ButtonSize = 'base') {
  const sizeMap: Record<ButtonSize, number> = {
    'base': 20,
    'xs': 20,
    'sm': 20,
    'lg': 24,
    'xl': 24,
  };
  return sizeMap[size];
}

const IconButton = forwardRef<
  typeof Button,
  IconButtonProps & ComponentProps<typeof Button>
>(
  (
    {
      type = 'basic',
      name,
      size,
      circle,
      isLoading,
      isDisabled,
      borderRadius,
      disabled,
      ...props
    },
    ref,
  ) => {
    const rect = getRect(size);
    const iconSize = getIconSize(size);
    return (
      <Button
        ref={ref}
        isLoading={isLoading}
        isDisabled={disabled ?? isDisabled}
        type={type}
        pt={rect}
        pr={rect}
        pb={rect}
        pl={rect}
        borderRadius={circle ? 'full' : borderRadius ?? 12}
        leftIconName={name}
        iconSize={iconSize}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export default IconButton;
