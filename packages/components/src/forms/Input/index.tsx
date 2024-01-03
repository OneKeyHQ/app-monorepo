import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { ForwardedRef, RefObject } from 'react';

import { Group, Input as TMInput, getFontSize, useThemeName } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../hooks';
import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import { getSharedInputStyles } from './sharedStyles';

import type { IInputAddOnProps } from './InputAddOnItem';
import type { IKeyOfIcons } from '../../primitives';
import type {
  HostComponent,
  MeasureLayoutOnSuccessCallback,
  MeasureOnSuccessCallback,
  TextInput,
} from 'react-native';
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

export type IInputRef = {
  focus: () => void;
};

const SIZE_MAPPINGS = {
  'large': {
    paddingLeftWithIcon: '$10',
    height: 46,
    iconLeftPosition: 13,
  },
  'medium': {
    paddingLeftWithIcon: '$9',
    height: 38,
    iconLeftPosition: 9,
  },
  'small': {
    paddingLeftWithIcon: '$8',
    height: 30,
    iconLeftPosition: 5,
  },
};

const useReadOnlyStyle = (readOnly = false) =>
  useMemo(
    () =>
      readOnly
        ? {
            editable: platformEnv.isNativeAndroid ? false : undefined,
            pointerEvents: 'none',
          }
        : undefined,
    [readOnly],
  );

const useAutoFocus = (inputRef: RefObject<TextInput>, autoFocus?: boolean) => {
  const shouldReloadAutoFocus = useMemo(
    () => platformEnv.isRuntimeBrowser && autoFocus,
    [autoFocus],
  );
  useEffect(() => {
    // focus after the animation of Dialog and other containers is finished,
    //  to avoid the misalignment caused by the container recalculating its height
    if (!shouldReloadAutoFocus) {
      return;
    }
    if (platformEnv.isRuntimeChrome) {
      // @ts-expect-error
      inputRef.current?.focus({ preventScroll: true });
    } else {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [inputRef, shouldReloadAutoFocus]);
  return shouldReloadAutoFocus ? false : autoFocus;
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
  ref: ForwardedRef<IInputRef>,
) {
  const { paddingLeftWithIcon, height, iconLeftPosition } = SIZE_MAPPINGS[size];

  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });
  const themeName = useThemeName();
  const inputRef: RefObject<TextInput> | null = useRef(null);
  const reloadAutoFocus = useAutoFocus(inputRef, autoFocus);
  const readOnlyStyle = useReadOnlyStyle(readonly);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    measureLayout: (
      relativeToNativeComponentRef:
        | React.ElementRef<HostComponent<unknown>>
        | number,
      onSuccess: MeasureLayoutOnSuccessCallback,
      onFail?: () => void,
    ) =>
      inputRef.current?.measureLayout(
        relativeToNativeComponentRef,
        onSuccess,
        onFail,
      ),
    measure: (callback: MeasureOnSuccessCallback) =>
      inputRef.current?.measure(callback),
  }));

  const selectionColor = useThemeValue('bgPrimary');
  return (
    <Group
      orientation="horizontal"
      borderRadius={sharedStyles.borderRadius}
      disablePassBorderRadius={!addOns?.length && !leftAddOnProps}
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
          // @ts-expect-error
          pointerEvents={readonly ? 'none' : 'auto'}
          /* 
          use height instead of lineHeight because of a RN issue while render TextInput on iOS
          https://github.com/facebook/react-native/issues/28012
        */
          h={height}
          py={sharedStyles.py}
          pr={sharedStyles.px}
          pl={leftIconName ? paddingLeftWithIcon : sharedStyles.px}
          fontSize={
            size === 'small' ? getFontSize('$bodyMd') : getFontSize('$bodyLg')
          }
          color={sharedStyles.color}
          placeholderTextColor={sharedStyles.placeholderTextColor}
          borderWidth={sharedStyles.borderWidth}
          borderColor={sharedStyles.borderColor}
          bg={sharedStyles.backgroundColor}
          selectionColor={selectionColor}
          borderRadius={size === 'large' ? '$3' : '$2'}
          borderRightWidth={addOns?.length ? '$0' : '$px'}
          borderLeftWidth={leftAddOnProps ? '$0' : '$px'}
          focusStyle={sharedStyles.focusStyle}
          cursor={sharedStyles.cursor}
          keyboardAppearance={/dark/.test(themeName) ? 'dark' : 'light'}
          style={{
            borderCurve: 'continuous',
          }}
          autoFocus={reloadAutoFocus}
          {...readOnlyStyle}
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
            {addOns.map(({ iconName, iconColor, label, onPress, loading }) => {
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
            })}
          </Group>
        </Group.Item>
      )}
    </Group>
  );
}

const forwardRefInput = forwardRef<IInputRef, IInputProps>(BaseInput);

export const Input = forwardRefInput;
