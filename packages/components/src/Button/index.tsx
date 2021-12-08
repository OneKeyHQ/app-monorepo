import React, { FC, ComponentProps } from 'react';
import { Button as NativeBaseButton } from 'native-base';

type ButtonSize = 'base' | 'xs' | 'sm' | 'lg' | 'xl';
type ButtonType = 'primary' | 'basic' | 'plain' | 'destructive' | 'outline';

type ButtonPropsWithoutType = {
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  onPress?: () => void;
};

type ButtonProps = ButtonPropsWithoutType & { type?: ButtonType };

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

const BasicButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIcon,
  rightIcon,
  children,
  ...props
}) => {
  const [px, py] = getPadding(size);
  const fontSize = getFontSize(size);
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="outline"
      px={px}
      py={py}
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
  leftIcon,
  rightIcon,
  children,
  ...props
}) => {
  const [px, py] = getPadding(size);
  const fontSize = getFontSize(size);
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="solid"
      px={px}
      py={py}
      shadow="1"
      _text={{ color: 'text-on-primary', fontSize }}
      bg="action-primary-default"
      _hover={{ bg: 'action-primary-hovered' }}
      _focus={{ bg: 'action-primary-default' }}
      _pressed={{ bg: 'action-primary-hovered' }}
      _loading={{ bg: 'action-primary-disabled' }}
      _disabled={{ bg: 'action-primary-disabled', color: 'text-disabled' }}
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
  leftIcon,
  rightIcon,
  children,
  ...props
}) => {
  const [px, py] = getPadding(size);
  const fontSize = getFontSize(size);
  return (
    <NativeBaseButton
      isDisabled={isDisabled}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="ghost"
      px={px}
      py={py}
      _text={{ color: 'text-default', fontSize }}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: undefined }}
      _focus={{ bg: undefined }}
      _disabled={{ color: 'text-disabled' }}
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const DesctructiveButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIcon,
  rightIcon,
  children,
  ...props
}) => {
  const [px, py] = getPadding(size);
  const fontSize = getFontSize(size);
  return (
    <NativeBaseButton
      isDisabled={isDisabled || isLoading}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="solid"
      px={px}
      py={py}
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
  leftIcon,
  rightIcon,
  children,
  ...props
}) => {
  const [px, py] = getPadding(size);
  const fontSize = getFontSize(size);
  return (
    <NativeBaseButton
      isDisabled={isDisabled}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      borderRadius="12"
      variant="outline"
      px={px}
      py={py}
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
      shadow="1"
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const Button: FC<ComponentProps<typeof NativeBaseButton> & ButtonProps> = ({
  type = 'basic',
  ...props
}) => {
  const components: Record<ButtonType, FC<ButtonPropsWithoutType>> = {
    'basic': BasicButton,
    'destructive': DesctructiveButton,
    'outline': OutlineButton,
    'plain': PlainButton,
    'primary': PrimaryButton,
  };
  const Component = components[type];
  return <Component {...props} />;
};

export default Button;
