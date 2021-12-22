import React, { ComponentProps, FC } from 'react';

import Button, { ButtonSize, ButtonType } from '../Button';
import { ICON_NAMES } from '../Icon';

type IconButtonProps = {
  name: ICON_NAMES;
  type?: ButtonType;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  circle?: boolean;
};

function getRect(size: ButtonSize = 'base') {
  const sizeMap: Record<ButtonSize, number> = {
    'base': 9,
    'xs': 8,
    'sm': 8,
    'lg': 10,
    'xl': 12,
  };
  return sizeMap[size];
}

function getIconSize(size: ButtonSize = 'base') {
  const sizeMap: Record<ButtonSize, number> = {
    'base': 20,
    'xs': 16,
    'sm': 20,
    'lg': 20,
    'xl': 24,
  };
  return sizeMap[size];
}

const IconButton: FC<IconButtonProps & ComponentProps<typeof Button>> = ({
  type = 'basic',
  name,
  size,
  circle,
  isLoading,
  isDisabled,
  ...props
}) => {
  const rect = getRect(size);
  const iconSize = getIconSize(size);
  return (
    <Button
      isLoading={isLoading}
      isDisabled={isDisabled}
      type={type}
      width={rect}
      height={rect}
      borderRadius={circle ? 'full' : 12}
      leftIconName={name}
      iconSize={iconSize}
      {...props}
    />
  );
};

export default IconButton;
