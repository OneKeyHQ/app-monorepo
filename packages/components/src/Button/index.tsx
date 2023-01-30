import type {
  ComponentProps,
  ForwardRefExoticComponent,
  RefAttributes,
} from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { StyleSheet } from 'react-native';

import { usePrevious } from '@onekeyhq/kit/src/hooks';
import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import Icon from '../Icon';
import useProviderValue from '../Provider/hooks/useProviderValue';
import { Spinner } from '../Spinner';
import { getTypographyStyleProps } from '../Typography';

import NativeBaseButton from './ButtonCapture';

import type { ICON_NAMES } from '../Icon';
import type { ThemeToken } from '../Provider/theme';
import type { TypographyStyle } from '../Typography';
import type { Text } from 'native-base';
import type { ColorType } from 'native-base/lib/typescript/components/types';

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
  children?: React.ReactNode;
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

const useNbTextProps = (
  textColor: ColorType,
  size: ButtonSize = 'base',
  textProps?: FontProps,
) =>
  useMemo(
    () => ({
      color: textColor,
      ...getTextProps(size),
      ...textProps,
    }),
    [size, textColor, textProps],
  );

const BasicButton = forwardRef<typeof NativeBaseButton, ButtonPropsWithoutType>(
  (
    {
      size,
      isDisabled,
      isLoading,
      leftIconName,
      rightIconName,
      iconSize,
      textProps,
      children,
      ...props
    },
    ref,
  ) => {
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
    const nbTextProps = useNbTextProps('text-default', size, textProps);
    return (
      <NativeBaseButton
        ref={ref}
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        borderRadius="12"
        variant="outline"
        bg="action-secondary-default"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="border-default"
        _text={nbTextProps}
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
          // @ts-ignore
          cursor: 'not-allowed',
          opacity: 1,
          _text: { color: 'text-disabled' },
        }}
        shadow={isDisabled || isLoading ? undefined : 'depth.1'}
        {...props}
      >
        {children}
      </NativeBaseButton>
    );
  },
);
BasicButton.displayName = 'BasicButton';

const PrimaryButton = forwardRef<
  typeof NativeBaseButton,
  ButtonPropsWithoutType
>(
  (
    {
      size,
      isDisabled,
      isLoading,
      leftIconName,
      rightIconName,
      iconSize,
      textProps,
      children,
      ...props
    },
    ref,
  ) => {
    const nbTextProps = useNbTextProps('text-on-primary', size, textProps);
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
        ref={ref}
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        borderRadius="12"
        variant="solid"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="transparent"
        _text={nbTextProps}
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
          // @ts-ignore
          cursor: 'not-allowed',
          opacity: 1,
          _text: { color: 'text-disabled' },
        }}
        shadow={isDisabled || isLoading ? undefined : 'depth.1'}
        {...props}
      >
        {children}
      </NativeBaseButton>
    );
  },
);
PrimaryButton.displayName = 'PrimaryButton';

const PlainButton = forwardRef<typeof NativeBaseButton, ButtonPropsWithoutType>(
  (
    {
      size,
      isDisabled,
      isLoading,
      leftIconName,
      rightIconName,
      iconSize,
      textProps,
      children,
      ...props
    },
    ref,
  ) => {
    const nbTextProps = useNbTextProps('text-default', size, textProps);
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
        ref={ref}
        isDisabled={isDisabled}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        borderRadius="12"
        variant="ghost"
        _text={nbTextProps}
        _hover={{ bg: 'surface-hovered' }}
        _pressed={{ bg: 'surface-pressed' }}
        _focus={{ bg: undefined }}
        _disabled={{
          color: 'text-disabled',
          // @ts-ignore
          cursor: 'not-allowed',
          opacity: 1,
        }}
        {...props}
      >
        {children}
      </NativeBaseButton>
    );
  },
);
PlainButton.displayName = 'PlainButton';

const DestructiveButton = forwardRef<
  typeof NativeBaseButton,
  ButtonPropsWithoutType
>(
  (
    {
      size,
      isDisabled,
      isLoading,
      leftIconName,
      rightIconName,
      iconSize,
      textProps,
      children,
      ...props
    },
    ref,
  ) => {
    const nbTextProps = useNbTextProps('text-on-critical', size, textProps);
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
        ref={ref}
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        borderRadius="12"
        variant="solid"
        borderWidth={StyleSheet.hairlineWidth}
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
          // @ts-ignore
          cursor: 'not-allowed',
          opacity: 1,
          _text: { color: 'text-disabled' },
        }}
        _text={nbTextProps}
        _focus={{
          bg: 'action-critical-hovered',
        }}
        _pressed={{
          bg: 'action-critical-hovered',
        }}
        _spinner={{ size: iconSize }}
        shadow={isDisabled || isLoading ? undefined : 'depth.1'}
        {...props}
      >
        {children}
      </NativeBaseButton>
    );
  },
);
DestructiveButton.displayName = 'DestructiveButton';

const OutlineButton = forwardRef<
  typeof NativeBaseButton,
  ButtonPropsWithoutType
>(
  (
    {
      size,
      isDisabled,
      isLoading,
      leftIconName,
      rightIconName,
      iconSize,
      textProps,
      children,
      ...props
    },
    ref,
  ) => {
    const nbTextProps = useNbTextProps('text-critical', size, textProps);
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
        ref={ref}
        isDisabled={isDisabled}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        borderRadius="12"
        variant="outline"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="border-critical-default"
        _text={nbTextProps}
        _focus={{ bg: undefined, borderColor: 'border-critical-default' }}
        _pressed={{ bg: undefined, borderColor: 'border-critical-default' }}
        _hover={{
          bg: 'surface-critical-subdued-hovered',
          borderColor: 'border-critical-default',
        }}
        _disabled={{
          borderColor: 'border-disabled',
          _text: { color: 'text-disabled' },
          // @ts-ignore
          cursor: 'not-allowed',
          opacity: 1,
        }}
        _loading={{
          borderColor: 'border-disabled',
          _text: { color: 'text-disabled' },
        }}
        shadow={isDisabled || isLoading ? undefined : 'depth.1'}
        {...props}
      >
        {children}
      </NativeBaseButton>
    );
  },
);
OutlineButton.displayName = 'OutlineButton';

const components: Record<
  ButtonType,
  ForwardRefExoticComponent<
    ButtonPropsWithoutType & RefAttributes<typeof NativeBaseButton>
  >
> = {
  'basic': BasicButton,
  'destructive': DestructiveButton,
  'outline': OutlineButton,
  'plain': PlainButton,
  'primary': PrimaryButton,
};
const Button = forwardRef<
  any,
  Omit<ComponentProps<typeof NativeBaseButton>, 'size'> & ButtonProps
>(
  (
    { type = 'basic', size, iconSize, leftIconName, rightIconName, ...props },
    ref,
  ) => {
    let [pt, pr, pb, pl] = getPadding(size);
    const buttonIconSize = iconSize ?? getIconSize(size);
    const Component = components[type];
    if (leftIconName) {
      pl = getPaddingWithIcon(size);
    }
    if (rightIconName) {
      pr = getPaddingWithIcon(size);
    }
    const textProps: FontProps | undefined = useMemo(() => {
      if (leftIconName) {
        if (size === 'xl' || size === 'lg') {
          return { pl: '1' };
        }
      }
      if (rightIconName) {
        if (size === 'xl' || size === 'lg') {
          return { pr: '1' };
        }
      }
    }, [leftIconName, rightIconName, size]);
    const spinner = useMemo(() => <Spinner size="sm" />, []);
    return (
      <Component
        ref={ref}
        pt={pt}
        pr={pr}
        pb={pb}
        pl={pl}
        textProps={textProps}
        iconSize={buttonIconSize}
        size={size}
        leftIconName={leftIconName}
        rightIconName={rightIconName}
        spinner={spinner}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

type OkButtonProps = {
  onPromise?: () => Promise<any>;
};

const OkButton = forwardRef<
  typeof Button,
  ComponentProps<typeof Button> & OkButtonProps
>(({ onPress, onPromise, isLoading, ...props }, ref) => {
  const [loading, setLoading] = useState(isLoading);
  // Handling when isLoading and onPromise are present at the same time
  const prevLoadingState = usePrevious<boolean | undefined>(loading);
  const { hapticsEnabled } = useProviderValue();
  const handlePress = useCallback(() => {
    if (hapticsEnabled) {
      enableHaptics();
    }
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
  }, [hapticsEnabled, onPromise, isLoading, onPress]);
  useEffect(() => {
    if (
      typeof isLoading !== 'undefined' ||
      (typeof prevLoadingState === 'boolean' &&
        typeof isLoading === 'undefined')
    ) {
      setLoading(!!isLoading);
    }
  }, [isLoading, prevLoadingState]);
  return (
    <Button ref={ref} {...props} onPress={handlePress} isLoading={loading} />
  );
});
OkButton.displayName = 'OkButton';

export default memo(OkButton);
