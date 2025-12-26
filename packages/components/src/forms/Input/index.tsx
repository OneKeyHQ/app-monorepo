import type {
  ComponentType,
  CompositionEventHandler,
  ForwardedRef,
  RefObject,
} from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EPasteEventPayloadItemType } from '@onekeyfe/react-native-text-input/src/enum';
import noop from 'lodash/noop';

import {
  Group,
  getFontSize,
  useProps,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';
import type { IQRCodeHandlerParseOutsideOptions } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useClipboard, useSelectionColor } from '../../hooks';
import { useScrollToLocation } from '../../layouts/ScrollView';
import { Icon } from '../../primitives';

import { Input as TMInput } from './Input';
import { type IInputAddOnProps, InputAddOnItem } from './InputAddOnItem';
import { getSharedInputStyles } from './sharedStyles';

import type {
  IGroupProps,
  IKeyOfIcons,
  IStackProps,
  IStackStyle,
} from '../../primitives';
import type { IInputProps as ITMInputProps } from '../TextArea/TamaguiInput';
import type {
  IPasteEventParams,
  IPasteEventPayload,
} from '@onekeyfe/react-native-text-input';
import type {
  HostComponent,
  MeasureLayoutOnSuccessCallback,
  MeasureOnSuccessCallback,
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
} from 'react-native';

export { EPasteEventPayloadItemType } from '@onekeyfe/react-native-text-input/src/enum';

export type {
  IPasteEventParams,
  IPasteEventPayload,
  IPasteEventPayloadItem,
} from '@onekeyfe/react-native-text-input';

export type IInputProps = {
  InputComponent?: ComponentType;
  InputComponentStyle?: IStackStyle;
  addOnsContainerProps?: IStackProps;
  addOnsItemProps?: IStackProps;
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  leftIconName?: IKeyOfIcons;
  error?: boolean;
  leftAddOnProps?: IInputAddOnProps;
  addOns?: IInputAddOnProps[];
  allowClear?: boolean; // add clear button when controlled value is not empty
  allowPaste?: boolean; // add paste button
  allowScan?: boolean; // add scan button
  startScanQrCode?: (
    params: IQRCodeHandlerParseOutsideOptions,
  ) => Promise<{ raw?: string }>; // const { start: startScanQrCode } = useScanQrCode();
  clearClipboardOnPaste?: boolean; // clear clipboard on paste
  autoFocusDelayMs?: number;
  selectTextOnFocus?: boolean;
  /**
   * Auto scroll to top delay in milliseconds.
   * Default is 250ms, only works on Android.
   */
  autoScrollTopDelayMs?: number;
  allowSecureTextEye?: boolean;
  containerProps?: IGroupProps;
  onPaste?: (event: IPasteEventParams) => void;
  onChangeText?: ((text: string) => string | void) | undefined;
  onSecureTextEntryChange?: (secureTextEntry: boolean) => void;
} & Omit<ITMInputProps, 'size' | 'onChangeText' | 'onPaste' | 'readOnly'> & {
    /** Web only */
    onCompositionStart?: CompositionEventHandler<any>;
    /** Web only */
    onCompositionEnd?: CompositionEventHandler<any>;
  };

export type IInputRef = {
  focus: () => void;
  blur: () => void;
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

export const useAutoScrollToTop = platformEnv.isNativeAndroid
  ? (ref: RefObject<TextInput | null>, waitMs = 250) => {
      useEffect(() => {
        setTimeout(() => {
          ref.current?.setSelection(0, 0);
        }, waitMs);
      }, [ref, waitMs]);
    }
  : () => {};

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

export const useAutoFocus = (
  inputRef: RefObject<TextInput | null>,
  autoFocus?: boolean,
  autoFocusDelayMs?: number,
) => {
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
      }, autoFocusDelayMs || 150);
    }
  }, [autoFocusDelayMs, inputRef, shouldReloadAutoFocus]);
  return shouldReloadAutoFocus ? false : autoFocus;
};

// Fix for Android input not rendering value correctly on first render in React Native 0.79.x
// This hook ensures proper value display by controlling the rendering timing
export const useFixAndroidInputValueDisplay = platformEnv.isNativeAndroid
  ? (value: string | undefined) => {
      const [isRendered, setIsRendered] = useState(false);
      useEffect(() => {
        setTimeout(() => {
          setIsRendered(true);
        }, 0);
      }, []);
      return isRendered ? value : '';
    }
  : (value: string | undefined) => value;

export const useOnWebPaste = platformEnv.isNative
  ? noop
  : (
      inputRef: RefObject<TextInput> | null,
      onPaste?: (event: IPasteEventParams) => void,
    ) => {
      useEffect(() => {
        if (!platformEnv.isNative && inputRef?.current && onPaste) {
          const handleWebPaste = (event: {
            type: 'paste';
            clipboardData: {
              items: DataTransferItem[];
            };
          }) => {
            if (event.type === 'paste') {
              const clipboardData = event.clipboardData;
              if (clipboardData && clipboardData.items.length > 0) {
                const items: IPasteEventPayload = [];
                const promises: Promise<void>[] = [];

                for (let i = 0; i < clipboardData.items.length; i += 1) {
                  const item = clipboardData.items[i];
                  if (item.kind === 'string') {
                    promises.push(
                      new Promise<void>((resolve) => {
                        item.getAsString((pastedText) => {
                          items.push({
                            data: pastedText,
                            type: EPasteEventPayloadItemType.TextPlain,
                          });
                          resolve();
                        });
                      }),
                    );
                  }
                }

                void Promise.all(promises).then(() => {
                  onPaste({ nativeEvent: { items } });
                });
              }
            }
          };
          const inputElement = inputRef.current as unknown as HTMLInputElement;
          inputElement.addEventListener('paste', handleWebPaste as any);
          return () => {
            inputElement.removeEventListener('paste', handleWebPaste as any);
          };
        }
      }, [inputRef, onPaste]);
    };

function BaseInput(
  inputProps: IInputProps,
  forwardedRef: ForwardedRef<IInputRef>,
) {
  const {
    InputComponent = TMInput,
    size = 'medium',
    leftAddOnProps,
    leftIconName,
    addOns: addOnsInProps,
    allowClear,
    allowPaste,
    allowScan,
    allowSecureTextEye,
    startScanQrCode,
    clearClipboardOnPaste,
    disabled,
    editable,
    error,
    containerProps,
    addOnsContainerProps,
    addOnsItemProps,
    readonly,
    autoFocus,
    selectTextOnFocus,
    onFocus,
    value,
    onPaste: onPasteProps,
    onChangeText,
    keyboardType,
    InputComponentStyle,
    autoFocusDelayMs,
    autoScrollTopDelayMs,
    secureTextEntry,
    onSecureTextEntryChange,
    ...props
  } = useProps(inputProps) as IInputProps;
  const { paddingLeftWithIcon, height, iconLeftPosition } = SIZE_MAPPINGS[size];

  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });
  const themeName = useThemeName();
  const inputRef: RefObject<TextInput | null> | null = useRef(null);
  const reloadAutoFocus = useAutoFocus(inputRef, autoFocus, autoFocusDelayMs);
  const readOnlyStyle = useReadOnlyStyle(readonly);
  const { clearText, getClipboard, supportPaste, onPasteClearText } =
    useClipboard();

  const onPaste = useCallback(
    (event: IPasteEventParams) => {
      onPasteProps?.(event);
      if (clearClipboardOnPaste) {
        onPasteClearText?.(event);
      }
    },
    [onPasteProps, clearClipboardOnPaste, onPasteClearText],
  );

  const [secureEntryState, setSecureEntryState] = useState(true);

  const usedSecureTextEntry = useMemo(() => {
    if (allowSecureTextEye) {
      return secureEntryState;
    }
    return secureTextEntry;
  }, [allowSecureTextEye, secureEntryState, secureTextEntry]);

  const addOns = useMemo<IInputAddOnProps[] | undefined>(() => {
    const allAddOns = [...(addOnsInProps ?? [])];
    if (allowClear && inputProps?.value) {
      allAddOns.push({
        iconName: 'XCircleOutline',
        onPress: () => {
          inputRef?.current?.clear();
          onChangeText?.('');
        },
      });
    }
    if (allowScan) {
      allAddOns.push({
        iconName: 'ScanOutline',
        onPress: async () => {
          /*
          const result = await start({
            handlers: [],
            autoHandleResult: false,
          });
          form.setValue('input', result.raw);
          */
          if (!startScanQrCode) {
            throw new OneKeyLocalError('props startScanQrCode is required');
          }
          const result = await startScanQrCode?.({
            handlers: [],
            autoHandleResult: false,
          });
          if (result?.raw) {
            onChangeText?.(result.raw || '');
          }
        },
      });
    }
    if (allowPaste && supportPaste) {
      allAddOns.push({
        iconName: 'ClipboardOutline' as IKeyOfIcons,
        onPress: async () => {
          const text = await getClipboard();
          if (text) {
            onChangeText?.(text || '');
            if (clearClipboardOnPaste) {
              clearText();
            }
          }
        },
      });
    }
    if (allowSecureTextEye) {
      allAddOns.push({
        iconName: secureEntryState ? 'EyeOffOutline' : 'EyeOutline',
        onPress: () => {
          onSecureTextEntryChange?.(!secureEntryState);
          setSecureEntryState(!secureEntryState);
        },
      });
    }
    return allAddOns;
  }, [
    addOnsInProps,
    allowClear,
    inputProps?.value,
    allowScan,
    allowPaste,
    supportPaste,
    allowSecureTextEye,
    onChangeText,
    startScanQrCode,
    getClipboard,
    clearClipboardOnPaste,
    clearText,
    secureEntryState,
    onSecureTextEntryChange,
  ]);

  useOnWebPaste(inputRef, onPaste);

  useAutoScrollToTop(inputRef, autoScrollTopDelayMs);

  useImperativeHandle(forwardedRef, () => ({
    ...inputRef.current,
    focus: () => {
      inputRef.current?.focus();
    },
    blur: () => {
      inputRef.current?.blur();
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

  const shownValue = useFixAndroidInputValueDisplay(value);
  const { scrollToView } = useScrollToLocation(inputRef);
  // workaround for selectTextOnFocus={true} not working on Native App
  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      onFocus?.(e);
      if (platformEnv.isNative && selectTextOnFocus) {
        const currentTarget = e.currentTarget;
        void timerUtils.setTimeoutPromised(() => {
          currentTarget?.setNativeProps({
            selection: { start: 0, end: valueRef.current?.length || 0 },
          });
        });
      }
      scrollToView();
    },
    [onFocus, scrollToView, selectTextOnFocus],
  );

  const onNumberPadChangeText = useCallback(
    (text: string) => {
      onChangeText?.(text.replace(',', '.'));
    },
    [onChangeText],
  );

  const isNumberKeyboardType = useMemo(
    () => keyboardType === 'decimal-pad' || keyboardType === 'number-pad',
    [keyboardType],
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
            {...leftAddOnProps}
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
        <InputComponent
          unstyled
          ref={inputRef}
          keyboardType={keyboardType}
          flex={1}
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
          value={shownValue}
          onFocus={handleFocus as any}
          selectTextOnFocus={selectTextOnFocus}
          editable={editable}
          secureTextEntry={usedSecureTextEntry}
          {...readOnlyStyle}
          {...InputComponentStyle}
          {...props}
          // @ts-expect-error
          onPaste={platformEnv.isNative ? onPaste : undefined}
          onChangeText={
            isNumberKeyboardType ? onNumberPadChangeText : onChangeText
          }
          allowFontScaling={false}
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
            {...(addOnsContainerProps as any)}
          >
            {addOns.map(
              (
                {
                  iconName,
                  iconColor,
                  label,
                  onPress,
                  loading,
                  testID = '',
                  renderContent,
                  tooltipProps,
                },
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
                  <Group.Item key={`${iconName || index}-${index}`}>
                    {renderContent ?? (
                      <InputAddOnItem
                        testID={testID}
                        key={`${iconName || ''}-${index}`}
                        label={label}
                        loading={loading}
                        size={size}
                        iconName={iconName}
                        iconColor={getIconColor()}
                        error={error}
                        onPress={onPress}
                        tooltipProps={tooltipProps}
                        {...addOnsItemProps}
                      />
                    )}
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

function BaseInputUnControlled(
  inputProps: IInputProps,
  ref: ForwardedRef<IInputRef>,
) {
  const inputRef: RefObject<IInputRef | null> = useRef(null);

  const [internalValue, setInternalValue] = useState(
    inputProps?.defaultValue || '',
  );
  const handleChange = useCallback(
    (text: string) => {
      setInternalValue(text);
      inputProps?.onChangeText?.(text);
    },
    [inputProps],
  );
  useImperativeHandle(
    ref,
    () =>
      inputRef.current || {
        focus: () => {},
        blur: () => {},
      },
  );

  return (
    <Input
      ref={inputRef}
      allowFontScaling={false}
      {...(inputProps as any)}
      value={internalValue}
      onChangeText={handleChange}
      defaultValue={undefined}
    />
  );
}

const forwardRefInputUnControlled = forwardRef<IInputRef, IInputProps>(
  BaseInputUnControlled,
);

export const InputUnControlled = forwardRefInputUnControlled;
