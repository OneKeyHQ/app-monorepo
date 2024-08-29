import { useMemo } from 'react';
import type { ReactElement } from 'react';

import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputProps } from '.';
import type { IKeyOfIcons, IXStackProps, SizeTokens } from '../../primitives';
import type { ColorTokens } from 'tamagui';

type IExtraProps = {
  label?: string;
  iconName?: IKeyOfIcons;
  iconColor?: ColorTokens;
  iconSize?: SizeTokens;
  size?: IInputProps['size'];
  error?: boolean;
  loading?: boolean;
  renderContent?: ReactElement;
};

export type IInputAddOnProps = IExtraProps & IXStackProps;

export const InputAddOnItem = XStack.styleable<IExtraProps>((props, ref) => {
  const {
    label,
    size,
    loading,
    iconName,
    iconColor,
    iconSize,
    disabled,
    error,
    onPress,
    ...rest
  } = props;

  const sharedStyles = getSharedInputStyles({ disabled, error });

  const sizeForIcon = useMemo(() => {
    if (iconSize) {
      return iconSize;
    }
    return size === 'small' ? '$5' : '$6';
  }, [iconSize, size]);
  return (
    <XStack
      ref={ref}
      alignItems="center"
      px={size === 'large' ? '$2.5' : '$2'}
      onPress={onPress}
      borderCurve="continuous"
      {...(onPress &&
        !disabled &&
        !loading && {
          userSelect: 'none',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
          focusable: !(disabled || loading),
          focusVisibleStyle: sharedStyles.focusVisibleStyle,
        })}
      {...rest}
    >
      {loading ? (
        <YStack {...(size !== 'small' && { p: '$0.5' })}>
          <Spinner size="small" />
        </YStack>
      ) : (
        iconName && (
          <Icon name={iconName} color={iconColor} size={sizeForIcon} />
        )
      )}
      {label ? (
        <SizableText
          size={size === 'small' ? '$bodyMd' : '$bodyLg'}
          ml={iconName ? '$2' : '$0'}
          color={disabled ? '$textDisabled' : '$textSubdued'}
        >
          {label}
        </SizableText>
      ) : null}
    </XStack>
  );
});
