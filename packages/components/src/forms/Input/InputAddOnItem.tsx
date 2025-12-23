import { useMemo } from 'react';
import type { ReactElement } from 'react';

import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Tooltip } from '../../actions/Tooltip';
import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputProps } from '.';
import type { ITooltipProps } from '../../actions';
import type { IKeyOfIcons, IXStackProps, SizeTokens } from '../../primitives';

type IExtraProps = {
  label?: string | ReactElement;
  iconName?: IKeyOfIcons;
  iconColor?: ColorTokens;
  iconSize?: SizeTokens;
  size?: IInputProps['size'];
  error?: boolean;
  loading?: boolean;
  renderContent?: ReactElement;
  tooltipProps?: Omit<ITooltipProps, 'renderTrigger'>;
};

export type IInputAddOnProps = IExtraProps & IXStackProps;

export const InputAddOnItem = XStack.styleable<IExtraProps, any, any>(
  (props: IInputAddOnProps, ref: any) => {
    const {
      label,
      size,
      loading,
      iconName,
      iconColor,
      disabled,
      error,
      onPress,
      renderContent,
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
          tabIndex={platformEnv.isNative ? undefined : rest.tabIndex}
          focusable={platformEnv.isNative ? false : rest.focusable}
        >
          {renderContent || (
            <>
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
            </>
          )}
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
        renderContent,
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
  },
);
