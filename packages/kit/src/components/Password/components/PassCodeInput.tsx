import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { StyleSheet, Text } from 'react-native';
import {
  CodeField,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

import { YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PassCodeRegex } from '../utils';

import type { TextInput } from 'react-native';

export const PIN_CELL_COUNT = 6;
export const AUTO_FOCUS_DELAY_MS = 380;

const CELL_SIZE = 16;
// Gap/size ratio that keeps the default 6-cell layout at its original 200px width.
const CELL_GAP_RATIO = 20.8 / CELL_SIZE;

function BasicPassCodeInput(
  {
    onPinCodeChange,
    onComplete,
    disabledComplete,
    autoFocus,
    editable,
    // showMask,
    testId,
    clearCode,
    clearCodeAndFocus,
    autoFocusDelayMs = AUTO_FOCUS_DELAY_MS,
    cellCount = PIN_CELL_COUNT,
    cellSize = CELL_SIZE,
    value,
    onSubmitEditing,
  }: {
    onPinCodeChange?: (pin: string) => void;
    onComplete?: () => void;
    disabledComplete?: boolean;
    autoFocus?: boolean;
    editable?: boolean;
    testId?: string;
    clearCode?: boolean;
    clearCodeAndFocus?: boolean;
    autoFocusDelayMs?: number;
    cellCount?: number;
    // Cells are tuned for a phone; wider layouts can scale them up.
    cellSize?: number;
    // Opt-in controlled mode: when provided, the parent owns the value and can
    // reset it (error retry, navigating back) without an extra clear flag.
    value?: string;
    // Keeps the hardware-keyboard submit path working for callers that had it
    // on a plain Input before.
    onSubmitEditing?: () => void;
    // showMask?: boolean;
  },
  forwardedRef: any,
) {
  const [pinValue, setPinValue] = useState('');
  // A controlled caller owns the digits: render its value and leave local state
  // alone, so an edit the caller rejects (e.g. during a cooldown) never shows up.
  const isControlled = value !== undefined;
  const displayValue = isControlled ? value : pinValue;
  const updateValue = (text: string) => {
    if (!isControlled) {
      setPinValue(text);
    }
  };

  const pinInputRef = useRef<TextInput>(null);
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: displayValue,
    // Tapping a cell truncates the code without going through onChangeText, so
    // report it too: a parent holding the value would otherwise keep the old
    // one and act on digits the user just erased.
    setValue: (text: string) => {
      // React Native only gates onPress on editable; onPressOut (which is what
      // this hook listens to) reaches the hidden TextInput either way, so a
      // disabled field would still be able to write back into parent state.
      if (editable === false) {
        return;
      }
      updateValue(text);
      // A tap that lands on the trailing cell slices to the same string; do not
      // wake up parents that reset errors or counters on every change.
      if (text !== displayValue) {
        onPinCodeChange?.(text);
      }
    },
  });
  // const [enableMask, setEnableMask] = useState(true);
  // const toggleMask = () => setEnableMask((f) => !f);

  const cellStyles = StyleSheet.create({
    cell: {
      width: cellSize,
      height: cellSize,
      overflow: 'visible',
    },
  });

  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      pinInputRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (autoFocus && pinInputRef.current) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, autoFocusDelayMs);
    }
  }, [autoFocusDelayMs, autoFocus]);

  const renderCell = ({
    index,
    symbol,
  }: // isFocused,
  {
    index: number;
    symbol: string;
    isFocused: boolean;
  }) => {
    const filledBg = editable ? '$borderActive' : '$borderDisabled';
    const bg = symbol ? filledBg : '$transparent';
    const borderColor = editable ? '$borderActive' : '$borderDisabled';
    return (
      <Text
        key={index}
        style={[cellStyles.cell]}
        onLayout={getCellOnLayoutHandler(index)}
      >
        <YStack
          w={cellSize}
          h={cellSize}
          backgroundColor={bg}
          borderWidth={1}
          borderRadius="$full"
          borderColor={borderColor}
          {...(platformEnv.isNativeAndroid
            ? {
                renderToHardwareTextureAndroid: true,
                overflow: 'hidden',
              }
            : {})}
        />
      </Text>
    );
  };
  useEffect(() => {
    if (clearCode) {
      setPinValue('');
    }
  }, [clearCode]);

  useEffect(() => {
    if (clearCodeAndFocus) {
      setPinValue('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, AUTO_FOCUS_DELAY_MS);
    }
  }, [clearCodeAndFocus]);
  return (
    <CodeField
      autoFocus={false}
      testID={testId}
      ref={pinInputRef}
      rootStyle={{
        flex: 1,
        paddingVertical: 32,
        alignSelf: 'center',
        width:
          cellCount * cellSize + (cellCount - 1) * cellSize * CELL_GAP_RATIO,
      }}
      value={displayValue}
      onChangeText={(text) => {
        const newText = text.replace(PassCodeRegex, '');
        updateValue(newText);
        onPinCodeChange?.(newText);
        if (newText.length === cellCount && !disabledComplete) {
          onComplete?.();
        }
      }}
      cellCount={cellCount}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      onSubmitEditing={onSubmitEditing}
      renderCell={renderCell}
      {...props}
      secureTextEntry
      editable={editable}
    />

    // <YStack gap="$4">
    //   {showMask ? (
    //     <IconButton
    //       icon={enableMask ? 'EyeOutline' : 'EyeOffOutline'}
    //       onPress={toggleMask}
    //     />
    //   ) : null}
    // </YStack>
  );
}

const PassCodeInput = forwardRef(BasicPassCodeInput);
export default PassCodeInput;
