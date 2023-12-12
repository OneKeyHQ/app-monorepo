import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { ForwardedRef, RefObject } from 'react';

import {
  Group,
  Input as TMInput,
  getFontSize,
  useMedia,
  useThemeName,
} from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../hooks';
import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputAddOnProps } from './InputAddOnItem';
import type { IKeyOfIcons } from '../../primitives';
import type { TextInput } from 'react-native';
import type { GetProps } from 'tamagui';

type ITMInputProps = GetProps<typeof TMInput>;

export type IInputProps = {
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  leftIconName?: IKeyOfIcons;
  error?: boolean;
  leftAddOnProps?: IInputAddOnProps;
  addOns?: IInputAddOnProps[];
  containerProps?: GetProps<typeof Group>;
  onChangeText?: ((text: string) => string | void) | undefined;
} & Omit<ITMInputProps, 'size' | 'onChangeText'>;

const SIZE_MAPPINGS = {
  'large': {
    verticalPadding: '$2.5',
    horizontalPadding: '$4',
    paddingLeftWithIcon: '$10',
    height: 46,
    iconLeftPosition: 13,
  },
  'medium': {
    verticalPadding: '$1.5',
    horizontalPadding: '$3',
    paddingLeftWithIcon: '$9',
    height: 38,
    iconLeftPosition: 9,
  },
  'small': {
    verticalPadding: '$1',
    horizontalPadding: '$2',
    paddingLeftWithIcon: '$8',
    height: 30,
    iconLeftPosition: 5,
  },
};

const useAutoFocus = (inputRef: RefObject<TextInput>, autoFocus?: boolean) => {
  const { md } = useMedia();
  const isWebMd = useMemo(
    () => autoFocus && platformEnv.isRuntimeBrowser && md,
    [autoFocus, md],
  );
  useEffect(() => {
    // focus after the animation of Dialog and other containers is finished,
    //  to avoid the misalignment caused by the container recalculating its height
    if (isWebMd) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [inputRef, isWebMd]);
  return isWebMd ? undefined : autoFocus;
};

function BaseInput(
  {
    size = 'medium',
    leftAddOnProps,
    leftIconName,
    addOns,
    disabled,
    editable,
    error,
    containerProps,
    readonly,
    autoFocus,
    ...props
  }: IInputProps,
  ref: ForwardedRef<any>,
) {
  const {
    verticalPadding,
    horizontalPadding,
    paddingLeftWithIcon,
    height,
    iconLeftPosition,
  } = SIZE_MAPPINGS[size];

  const sharedStyles = getSharedInputStyles({ disabled, editable, error });
  const themeName = useThemeName();
  const inputRef: RefObject<TextInput> | null = useRef(null);
  const _autoFocus = useAutoFocus(inputRef, autoFocus);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  const selectionColor = useThemeValue('bgPrimary');
  return (
    <Group
      orientation="horizontal"
      borderRadius={size === 'large' ? '$3' : '$2'}
      disabled={disabled}
      {...containerProps}
    >
      {/* left addon */}
      {leftAddOnProps && (
        <Group.Item>
          <XStack
            bg="$bgSubdued"
            borderWidth={sharedStyles.borderWidth}
            borderColor={sharedStyles.borderColor}
            alignItems="center"
            px={size === 'large' ? '$2.5' : '$2'}
            style={{
              borderCurve: 'continuous',
            }}
            {...(leftAddOnProps.onPress &&
              !disabled && {
                hoverStyle: {
                  bg: '$bgHover',
                },
                pressStyle: {
                  bg: '$bgActive',
                },
              })}
            {...(leftAddOnProps.onPress && {
              focusable: !disabled || !leftAddOnProps.loading,
            })}
            focusStyle={sharedStyles.focusStyle}
            {...leftAddOnProps}
          >
            {leftAddOnProps.loading ? (
              <YStack {...(size !== 'small' && { p: '$0.5' })}>
                <Spinner size="small" />
              </YStack>
            ) : (
              leftAddOnProps.iconName && (
                <Icon
                  name={leftAddOnProps.iconName}
                  color={leftAddOnProps.iconColor}
                  size={size === 'small' ? '$5' : '$6'}
                />
              )
            )}
            {leftAddOnProps.label && (
              <SizableText
                size={size === 'small' ? '$bodyMd' : '$bodyLg'}
                ml={leftAddOnProps.iconName ? '$2' : '$0'}
                color={disabled ? '$textDisabled' : '$textSubdued'}
              >
                {leftAddOnProps.label}
              </SizableText>
            )}
          </XStack>
        </Group.Item>
      )}

      {/* input */}
      <Group.Item>
        <TMInput
          unstyled
          ref={inputRef}
          flex={1}
          autoFocus={_autoFocus}
          pointerEvents={readonly ? 'none' : undefined}
          /* 
          use height instead of lineHeight because of a RN issue while render TextInput on iOS
          https://github.com/facebook/react-native/issues/28012
        */
          h={height}
          py={verticalPadding}
          pr={horizontalPadding}
          pl={leftIconName ? paddingLeftWithIcon : horizontalPadding}
          fontSize={
            size === 'small' ? getFontSize('$bodyMd') : getFontSize('$bodyLg')
          }
          color={sharedStyles.color}
          placeholderTextColor={sharedStyles.placeholderTextColor}
          borderWidth={sharedStyles.borderWidth}
          borderColor={sharedStyles.borderColor}
          bg={sharedStyles.backgroundColor}
          selectionColor={selectionColor}
          borderRightWidth={addOns?.length ? '$0' : '$px'}
          borderLeftWidth={leftAddOnProps ? '$0' : '$px'}
          focusStyle={sharedStyles.focusStyle}
          cursor={sharedStyles.cursor}
          keyboardAppearance={/dark/.test(themeName) ? 'dark' : 'light'}
          style={{
            borderCurve: 'continuous',
          }}
          {...props}
        />
      </Group.Item>

      {/* left icon */}
      {leftIconName && (
        <Icon
          position="absolute"
          name={leftIconName}
          size="$5"
          top="50%"
          y="$-2.5"
          left={iconLeftPosition}
          color={disabled ? '$iconDisabled' : '$iconSubdued'}
          pointerEvents="none"
        />
      )}

      {/* right elements */}
      {addOns?.length && (
        <Group.Item>
          <Group
            borderRadius={size === 'large' ? '$3' : '$2'}
            orientation="horizontal"
            borderWidth="$px"
            borderLeftWidth="$0"
            borderColor={sharedStyles.borderColor}
            bg={sharedStyles.backgroundColor}
            disabled={disabled}
            disablePassBorderRadius="start"
          >
            {addOns.map(
              ({ iconName, iconColor, testID, label, onPress, loading }) => {
                const getIconColor = () => {
                  if (disabled) {
                    return '$iconDisabled';
                  }
                  if (iconColor) {
                    return iconColor;
                  }
                  return '$iconSubdued';
                };

                return (
                  <Group.Item>
                    <XStack
                      onPress={onPress}
                      key={`${iconName || ''}-${label || ''}`}
                      alignItems="center"
                      px={size === 'large' ? '$2.5' : '$2'}
                      {...(onPress &&
                        !disabled && {
                          hoverStyle: {
                            bg: '$bgHover',
                          },
                          pressStyle: {
                            bg: '$bgActive',
                          },
                        })}
                      focusable={!(disabled || loading)}
                      focusStyle={sharedStyles.focusStyle}
                      style={{
                        borderCurve: 'continuous',
                      }}
                    >
                      {loading ? (
                        <YStack {...(size !== 'small' && { p: '$0.5' })}>
                          <Spinner size="small" />
                        </YStack>
                      ) : (
                        iconName && (
                          <Icon
                            name={iconName}
                            color={getIconColor()}
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
                  </Group.Item>
                );
              },
            )}
          </Group>
        </Group.Item>
      )}
    </Group>
  );
}

export const Input = forwardRef(BaseInput);
