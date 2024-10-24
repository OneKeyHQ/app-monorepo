import { type ReactElement, useMemo } from 'react';

import { Tooltip } from '../../actions/Tooltip';
import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputProps } from '.';
import type { ITooltipProps } from '../../actions';
import type { IKeyOfIcons, IXStackProps } from '../../primitives';
import type { ColorTokens } from 'tamagui';

type IExtraProps = {
  label?: string | ReactElement;
  iconName?: IKeyOfIcons;
  iconColor?: ColorTokens;
  size?: IInputProps['size'];
  error?: boolean;
  loading?: boolean;
  renderContent?: ReactElement;
  tooltipProps?: Omit<ITooltipProps, 'renderTrigger'>;
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
    tooltipProps,
    ...rest
  } = props;

  const sharedStyles = getSharedInputStyles({ disabled, error });

  const trigger = useMemo(
    () => (
      <XStack
        ref={ref}
        flex={tooltipProps ? 1 : undefined}
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
            <Icon
              name={iconName}
              color={iconColor}
              size={size === 'small' ? '$5' : '$6'}
            />
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
    ),
    [
      disabled,
      iconColor,
      iconName,
      label,
      loading,
      onPress,
      ref,
      rest,
      sharedStyles.focusVisibleStyle,
      size,
      tooltipProps,
    ],
  );
  return tooltipProps ? (
    <Tooltip renderTrigger={trigger} {...tooltipProps} />
  ) : (
    trigger
  );
});
