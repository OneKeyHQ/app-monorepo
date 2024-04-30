import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { CompositionEventHandler, ForwardedRef, RefObject } from 'react';

import { InteractionManager } from 'react-native';
import {
  Group,
  Input as TMInput,
  getFontSize,
  useProps,
  useThemeName,
} from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSelectionColor } from '../../hooks';
import { Icon } from '../../primitives';

import { type IInputAddOnProps, InputAddOnItem } from './InputAddOnItem';
import { getSharedInputStyles } from './sharedStyles';

import type { IGroupProps, IKeyOfIcons } from '../../primitives';
import type {
  HostComponent,
  MeasureLayoutOnSuccessCallback,
  MeasureOnSuccessCallback,
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
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
  containerProps?: IGroupProps;
  onChangeText?: ((text: string) => string | void) | undefined;
} & Omit<ITMInputProps, 'size' | 'onChangeText'> & {
    /** Web only */
    onCompositionStart?: CompositionEventHandler<any>;
    /** Web only */
    onCompositionEnd?: CompositionEventHandler<any>;
  };

export type IInputRef = {
  focus: () => void;
};

const SIZE_MAPPINGS = {
  'large': {
    paddingLeftWithIcon: '$10',
    height: 44,
    iconLeftPosition: 13,
  },
  'medium': {
    paddingLeftWithIcon: '$9',
    height: 36,
    iconLeftPosition: 9,
  },
  'small': {
    paddingLeftWithIcon: '$8',
    height: 28,
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

function BaseInput(inputProps: IInputProps, ref: ForwardedRef<IInputRef>) {
  const {
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
    selectTextOnFocus,
    onFocus,
    value,
    ...props
  } = useProps(inputProps);
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

  const selectionColor = useSelectionColor();

  const valueRef = useRef(value);
  if (valueRef.current !== value) {
    valueRef.current = value;
  }

  // workaround for selectTextOnFocus={true} not working on Native App
  const handleFocus = useCallback(
    async (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      onFocus?.(e);
      if (platformEnv.isNative && selectTextOnFocus) {
        const { currentTarget } = e;
        await InteractionManager.runAfterInteractions(() => {
          currentTarget.setNativeProps({
            selection: { start: 0, end: valueRef.current?.length || 0 },
          });
        });
      }
    },
    [onFocus, selectTextOnFocus],
  );

  return (
    <Group
      orientation="horizontal"
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      bg={sharedStyles.backgroundColor}
      borderRadius={sharedStyles.borderRadius}
      disabled={disabled}
      borderCurve="continuous"
      {...containerProps}
    >
      {/* left addon */}
      {leftAddOnProps ? (
        <Group.Item>
          <InputAddOnItem
            size={size}
            error={error}
            loading={leftAddOnProps.loading}
            label={leftAddOnProps.label}
            iconName={leftAddOnProps.iconName}
            iconColor={leftAddOnProps.iconColor}
            onPress={leftAddOnProps.onPress}
            testID={leftAddOnProps.testID}
          />
        </Group.Item>
      ) : null}

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
          selectionColor={selectionColor}
          cursor={sharedStyles.cursor}
          keyboardAppearance={/dark/.test(themeName) ? 'dark' : 'light'}
          borderCurve="continuous"
          autoFocus={reloadAutoFocus}
          value={value}
          onFocus={handleFocus}
          selectTextOnFocus={selectTextOnFocus}
          {...readOnlyStyle}
          {...props}
        />
      </Group.Item>

      {/* left icon */}
      {leftIconName ? (
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
      ) : null}

      {/* right elements */}
      {addOns?.length ? (
        <Group.Item>
          <Group
            borderRadius={sharedStyles.borderRadius}
            orientation="horizontal"
            disabled={disabled}
            disablePassBorderRadius="start"
          >
            {addOns.map(
              (
                { iconName, iconColor, label, onPress, loading, testID = '' },
                index,
              ) => {
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
                  <Group.Item key={`${iconName || index}-${label || index}`}>
                    <InputAddOnItem
                      testID={testID}
                      key={`${iconName || ''}-${label || ''}`}
                      label={label}
                      loading={loading}
                      size={size}
                      iconName={iconName}
                      iconColor={getIconColor()}
                      error={error}
                      onPress={onPress}
                    />
                  </Group.Item>
                );
              },
            )}
          </Group>
        </Group.Item>
      ) : null}
    </Group>
  );
}

const forwardRefInput = forwardRef<IInputRef, IInputProps>(BaseInput);

export const Input = forwardRefInput;
