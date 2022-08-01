import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { Text } from 'native-base';

import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import Icon, { ICON_NAMES } from '../Icon';
import { useProviderValue } from '../Provider/hooks';
import { ThemeToken } from '../Provider/theme';
import { Spinner } from '../Spinner';
import { TypographyStyle, getTypographyStyleProps } from '../Typography';

import NativeBaseButton from './ButtonCapture';

type FontProps = ComponentProps<typeof Text>;

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
  iconColor?: ThemeToken;
  leftIconName?: ICON_NAMES;
  rightIconName?: ICON_NAMES;
  textProps?: FontProps;
  onPress?: () => void;
};

export type ButtonProps = ButtonPropsWithoutType & { type?: ButtonType };

const getPadding = (
  size: ButtonSize = 'base',
): [number, number, number, number] => {
  const sizeMap: Record<ButtonSize, [number, number, number, number]> = {
    'base': [2, 4, 2, 4],
    'xs': [1.5, 2.5, 1.5, 2.5],
    'sm': [1.5, 3, 1.5, 3],
    'lg': [2, 4, 2, 4],
    'xl': [3, 6, 3, 6],
  };
  return sizeMap[size];
};

const getPaddingWithIcon = (size: ButtonSize = 'base'): number => {
  const sizeMap: Record<ButtonSize, number> = {
    'base': 3.5,
    'xs': 2,
    'sm': 2.5,
    'lg': 3.5,
    'xl': 5,
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

const getTextProps = (size: ButtonSize = 'base'): FontProps => {
  const styleMap: Record<ButtonSize, TypographyStyle> = {
    'base': 'Button2',
    'xs': 'CaptionStrong',
    'sm': 'Button2',
    'lg': 'Button1',
    'xl': 'Button1',
  };
  return getTypographyStyleProps(styleMap[size]);
};

const BasicButton: FC<ButtonPropsWithoutType> = ({
  size,
  isDisabled,
  isLoading,
  leftIconName,
  rightIconName,
  iconSize,
  textProps,
  children,
  ...props
}) => {
  const { iconColor } = props;
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-default')}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-default')}
    />
  ) : undefined;
  const nbTextProps = { ...getTextProps(size), ...textProps };
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
      _text={{ color: 'text-default', ...nbTextProps }}
      _hover={{
        bg: 'action-secondary-hovered',
        borderColor: 'border-default',
      }}
      _pressed={{
        background: 'action-secondary-pressed',
        borderColor: 'border-default',
      }}
      _disabled={{
        bg: 'action-secondary-disabled',
        borderColor: 'border-disabled',
        cursor: 'not-allowed',
        opacity: 1,
        _text: { color: 'text-disabled' },
      }}
      spinner={<Spinner size="sm" />}
      shadow={isDisabled || isLoading ? undefined : 'depth.1'}
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
  textProps,
  children,
  ...props
}) => {
  const nbTextProps = { ...getTextProps(size), ...textProps };
  const { iconColor } = props;
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-on-primary')}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-on-primary')}
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
      borderWidth="1"
      borderColor="transparent"
      _text={{ color: 'text-on-primary', ...nbTextProps }}
      bg="action-primary-default"
      _hover={{ bg: 'action-primary-hovered' }}
      _focus={{ bg: 'action-primary-default' }}
      _pressed={{ bg: 'action-primary-pressed' }}
      _loading={{
        bg: 'action-primary-disabled',
        borderColor: 'action-primary-disabled',
      }}
      _disabled={{
        bg: 'action-primary-disabled',
        borderColor: 'action-primary-disabled',
        color: 'text-disabled',
        cursor: 'not-allowed',
        opacity: 1,
        _text: { color: 'text-disabled' },
      }}
      spinner={<Spinner size="sm" />}
      shadow={isDisabled || isLoading ? undefined : 'depth.1'}
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
  textProps,
  children,
  ...props
}) => {
  const nbTextProps = { ...getTextProps(size), ...textProps };
  const { iconColor } = props;
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-default')}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-default')}
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
      _text={{ color: 'text-default', ...nbTextProps }}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      _focus={{ bg: undefined }}
      _disabled={{ color: 'text-disabled', cursor: 'not-allowed', opacity: 1 }}
      spinner={<Spinner size="sm" />}
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
  textProps,
  children,
  ...props
}) => {
  const nbTextProps = { ...getTextProps(size), ...textProps };
  const { iconColor } = props;
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-on-critical')}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-on-critical')}
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
      borderWidth="1"
      borderColor="action-critical-default"
      bg="action-critical-default"
      _hover={{ bg: 'action-critical-hovered' }}
      _loading={{
        bg: 'action-critical-disabled',
        borderColor: 'action-critical-disabled',
      }}
      _disabled={{
        bg: 'action-critical-disabled',
        borderColor: 'action-critical-disabled',
        cursor: 'not-allowed',
        opacity: 1,
        _text: { color: 'text-disabled' },
      }}
      _text={{
        color: 'text-on-critical',
        ...nbTextProps,
      }}
      _focus={{
        bg: 'action-critical-hovered',
      }}
      _pressed={{
        bg: 'action-critical-hovered',
      }}
      _spinner={{ size: iconSize }}
      spinner={<Spinner size="sm" />}
      shadow={isDisabled || isLoading ? undefined : 'depth.1'}
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
  textProps,
  children,
  ...props
}) => {
  const nbTextProps = { ...getTextProps(size), ...textProps };
  const { iconColor } = props;
  const leftIcon = leftIconName ? (
    <Icon
      size={iconSize}
      name={leftIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-critical')}
    />
  ) : undefined;
  const rightIcon = rightIconName ? (
    <Icon
      size={iconSize}
      name={rightIconName}
      color={iconColor || (isDisabled ? 'icon-disabled' : 'icon-critical')}
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
      _text={{ color: 'text-critical', ...nbTextProps }}
      _focus={{ bg: undefined, borderColor: 'border-critical-default' }}
      _pressed={{ bg: undefined, borderColor: 'border-critical-default' }}
      _hover={{
        bg: 'surface-critical-subdued-hovered',
        borderColor: 'border-critical-default',
      }}
      _disabled={{
        borderColor: 'border-disabled',
        _text: { color: 'text-disabled' },
        cursor: 'not-allowed',
        opacity: 1,
      }}
      _loading={{
        borderColor: 'border-disabled',
        _text: { color: 'text-disabled' },
      }}
      spinner={<Spinner size="sm" />}
      shadow={isDisabled || isLoading ? undefined : 'depth.1'}
      {...props}
    >
      {children}
    </NativeBaseButton>
  );
};

const Button: FC<
  Omit<ComponentProps<typeof NativeBaseButton>, 'size'> & ButtonProps
> = ({
  type = 'basic',
  size,
  iconSize,
  leftIconName,
  rightIconName,
  ...props
}) => {
  const components: Record<ButtonType, FC<ButtonPropsWithoutType>> = {
    'basic': BasicButton,
    'destructive': DestructiveButton,
    'outline': OutlineButton,
    'plain': PlainButton,
    'primary': PrimaryButton,
  };
  let [pt, pr, pb, pl] = getPadding(size);
  const buttonIconSize = iconSize ?? getIconSize(size);
  const Component = components[type];
  let textProps: FontProps | undefined;
  if (leftIconName) {
    pl = getPaddingWithIcon(size);
    if (size === 'xl' || size === 'lg') {
      textProps = { pl: '1' };
    }
  }
  if (rightIconName) {
    pr = getPaddingWithIcon(size);
    if (size === 'xl' || size === 'lg') {
      textProps = { pr: '1' };
    }
  }
  return (
    <Component
      pt={pt}
      pr={pr}
      pb={pb}
      pl={pl}
      textProps={textProps}
      iconSize={buttonIconSize}
      size={size}
      leftIconName={leftIconName}
      rightIconName={rightIconName}
      {...props}
    />
  );
};

type OkButtonProps = {
  onPromise?: () => Promise<any>;
};

const OkButton: FC<ComponentProps<typeof Button> & OkButtonProps> = ({
  onPress,
  onPromise,
  isLoading,
  ...props
}) => {
  const [loading, setLoading] = useState(isLoading);
  const handlePress = useCallback(() => {
    if (onPromise && typeof isLoading === 'undefined') {
      setLoading(true);
      setTimeout(() => {
        try {
          onPromise?.().finally(() => setLoading(false));
        } catch {
          setLoading(false);
        }
      });
    } else if (onPress) {
      onPress?.();
    }
  }, [onPress, onPromise, setLoading, isLoading]);
  const { hapticsEnabled } = useProviderValue();
  useEffect(() => {
    if (typeof isLoading !== 'undefined') {
      setLoading(isLoading);
    }
  }, [isLoading]);
  return (
    <Button
      {...props}
      onPress={() => {
        if (hapticsEnabled) {
          enableHaptics();
        }

        handlePress();
      }}
      isLoading={loading}
    />
  );
};

export default OkButton;
