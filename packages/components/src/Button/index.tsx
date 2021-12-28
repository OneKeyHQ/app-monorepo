import React, { ComponentProps, FC } from 'react';

import { Button as NativeBaseButton } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';

export type ButtonSize = 'base' | 'xs' | 'sm' | 'lg' | 'xl';
export type ButtonType =
  | 'primary'
  | 'basic'
  | 'plain'
  | 'destructive'
  | 'outline';

type ButtonPropsWithoutType = {
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  iconSize?: number;
  leftIconName?: ICON_NAMES;
  rightIconName?: ICON_NAMES;
  onPress?: () => void;
};

export type ButtonProps = ButtonPropsWithoutType & { type?: ButtonType };

const getPadding = (size: ButtonSize = 'base'): [number, number] => {
  const sizeMap: Record<ButtonSize, [number, number]> = {
    'base': [4, 2],
    'xs': [2.5, 1.5],
    'sm': [3, 1.5],
    'lg': [4, 2],
    'xl': [6, 3],
  };
  return sizeMap[size];
};

const getFontSize = (size: ButtonSize = 'base'): string => {
  const sizeMap: Record<ButtonSize, string> = {
    'base': 'sm',
    'xs': 'xs',
    'sm': 'sm',
    'lg': 'md',
    'xl': 'md',
  };
  return sizeMap[size];
};

const getIconSize = (size: ButtonSize = 'base'): number => {
  const sizeMap: Record<ButtonSize, number> = {
    'base': 20,
    'xs': 16,
    'sm': 16,
    'lg': 20,
    'xl': 20,
  };
  return sizeMap[size];
};

const BasicButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  children,
  ...props
}) => {
  const fontSize = getFontSize(size);
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-default'}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-default'}
    />
  ) : undefined;
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="outline"
      bg="action-secondary-default"
      borderWidth="1"
      borderColor="border-default"
      _text={{ color: 'text-default', fontSize }}
      _hover={{
        bg: 'action-secondary-hovered',
        borderColor: 'border-default',
      }}
      _pressed={{
        background: 'action-secondary-default',
        borderColor: 'border-default',
      }}
      _focus={{
        background: 'action-secondary-default',
        borderColor: 'border-default',
      }}
      _disabled={{
        bg: 'action-secondary-disabled',
        borderColor: 'border-disabled',
      }}
      _spinner={{ size: iconSize }}
      shadow="1"
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const PrimaryButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  children,
  ...props
}) => {
  const fontSize = getFontSize(size);
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-on-primary'}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-on-primary'}
    />
  ) : undefined;
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="solid"
      shadow="1"
      _text={{ color: 'text-on-primary', fontSize }}
      bg="action-primary-default"
      _hover={{ bg: 'action-primary-hovered' }}
      _focus={{ bg: 'action-primary-default' }}
      _pressed={{ bg: 'action-primary-hovered' }}
      _loading={{ bg: 'action-primary-disabled' }}
      _disabled={{ bg: 'action-primary-disabled', color: 'text-disabled' }}
      _spinner={{ size: iconSize }}
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const PlainButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  children,
  ...props
}) => {
  const fontSize = getFontSize(size);
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-default'}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-default'}
    />
  ) : undefined;
  return (
    <NativeBaseButton
      isDisabled={isDisabled}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="ghost"
      _text={{ color: 'text-default', fontSize }}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: undefined }}
      _focus={{ bg: undefined }}
      _disabled={{ color: 'text-disabled' }}
      _spinner={{ size: iconSize }}
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const DestructiveButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  children,
  ...props
}) => {
  const fontSize = getFontSize(size);
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-on-critical'}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-on-critical'}
    />
  ) : undefined;
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="solid"
      bg="action-critical-default"
      _hover={{ bg: 'action-critical-hovered' }}
      _disabled={{ bg: 'action-critical-disabled' }}
      _text={{
        color: 'text-on-critical',
        fontSize,
      }}
      _focus={{
        bg: 'action-critical-hovered',
      }}
      _pressed={{
        bg: 'action-critical-hovered',
      }}
      _spinner={{ size: iconSize }}
      shadow="1"
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const OutlineButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  children,
  ...props
}) => {
  const fontSize = getFontSize(size);
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-critical'}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={isDisabled ? 'icon-disabled' : 'icon-critical'}
    />
  ) : undefined;
  return (
    <NativeBaseButton
      isDisabled={isDisabled}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="outline"
      borderWidth="1"
      borderColor="border-critical-default"
      _text={{ color: 'text-critical', fontSize }}
      _focus={{ bg: undefined, borderColor: 'border-critical-default' }}
      _pressed={{ bg: undefined, borderColor: 'border-critical-default' }}
      _hover={{
        bg: 'surface-critical-subdued-hovered',
        borderColor: 'border-critical-default',
      }}
      _disabled={{
        borderColor: 'border-disabled',
        _text: { color: 'text-disabled' },
      }}
      _loading={{
        borderColor: 'border-disabled',
        _text: { color: 'text-disabled' },
      }}
      _spinner={{ size: iconSize }}
      shadow="1"
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const Button: FC<
  Omit<ComponentProps<typeof NativeBaseButton>, 'size'> & ButtonProps
> = ({ type = 'basic', size, iconSize, ...props }) => {
  const components: Record<ButtonType, FC<ButtonPropsWithoutType>> = {
    'basic': BasicButton,
    'destructive': DestructiveButton,
    'outline': OutlineButton,
    'plain': PlainButton,
    'primary': PrimaryButton,
  };
  const [px, py] = getPadding(size);
  const buttonIconSize = iconSize ?? getIconSize(size);
  const Component = components[type];
  return <Component px={px} py={py} iconSize={buttonIconSize} {...props} />;
};

export default Button;
