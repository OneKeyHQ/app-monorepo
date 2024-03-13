import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputProps } from '.';
import type { IKeyOfIcons, IXStackProps } from '../../primitives';
import type { ColorTokens } from 'tamagui';

type IExtraProps = {
  label?: string;
  iconName?: IKeyOfIcons;
  iconColor?: ColorTokens;
  size?: IInputProps['size'];
  error?: boolean;
  loading?: boolean;
};

export type IInputAddOnProps = IExtraProps & IXStackProps;

export const InputAddOnItem = XStack.styleable<IExtraProps>((props, ref) => {
  const {
    label,
    size,
    loading,
    iconName,
    iconColor,
    disabled,
    error,
    onPress,
    ...rest
  } = props;

  const sharedStyles = getSharedInputStyles({ disabled, error });

  return (
    <XStack
      ref={ref}
      alignItems="center"
      px={size === 'large' ? '$2.5' : '$2'}
      onPress={onPress}
      style={{
        borderCurve: 'continuous',
      }}
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
          focusStyle: sharedStyles.focusStyle,
        })}
      {...rest}
    >
      {loading ? (
        <YStack {...(size !== 'small' && { p: '$0.5' })}>
          <Spinner size="small" />
        </YStack>
      ) : (
        iconName && (
          <Icon
            name={iconName}
            color={iconColor}
            size={size === 'small' ? '$5' : '$6'}
          />
        )
      )}
      {label && (
        <SizableText
          size={size === 'small' ? '$bodyMd' : '$bodyLg'}
          ml={iconName ? '$2' : '$0'}
          color={disabled ? '$textDisabled' : '$textSubdued'}
        >
          {label}
        </SizableText>
      )}
    </XStack>
  );
});
