import { useEffect, useState } from 'react';

import { StyleSheet, Text } from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

import { IconButton, XStack } from '@onekeyhq/components';

export const PIN_CELL_COUNT = 6;

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  focusCell: {
    borderColor: '#000',
  },
});

const PassCodeInput = ({
  onPinCodeChange,
  onComplete,
  disabledComplete,
  pinCodeFocus,
  enableAutoFocus,
  showMask,
  testId,
}: {
  onPinCodeChange?: (pin: string) => void;
  onComplete?: () => void;
  disabledComplete?: boolean;
  pinCodeFocus?: boolean;
  enableAutoFocus?: boolean;
  testId?: string;
  showMask?: boolean;
}) => {
  const [pinValue, setPinValue] = useState('');

  const pinInputRef = useBlurOnFulfill({
    value: pinValue,
    cellCount: PIN_CELL_COUNT,
  });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: pinValue,
    setValue: setPinValue,
  });
  const [enableMask, setEnableMask] = useState(true);
  const toggleMask = () => setEnableMask((f) => !f);
  const renderCell = ({
    index,
    symbol,
    isFocused,
  }: {
    index: number;
    symbol: string;
    isFocused: boolean;
  }) => {
    let textChild = null;
    if (symbol) {
      textChild = enableMask ? '•' : symbol;
    } else if (isFocused) {
      textChild = <Cursor />;
    }

    return (
      <Text
        key={index}
        style={[
          ...[cellStyles.cell],
          ...(isFocused ? [cellStyles.focusCell] : []),
        ]}
        onLayout={getCellOnLayoutHandler(index)}
      >
        {textChild}
      </Text>
    );
  };

  useEffect(() => {
    if (pinCodeFocus) {
      pinInputRef.current?.focus();
    }
  }, [pinCodeFocus, pinInputRef]);

  return (
    <XStack gap="$1" minHeight={40}>
      <CodeField
        autoFocus={enableAutoFocus}
        testID={testId}
        ref={pinInputRef}
        {...props}
        rootStyle={{ flex: 1 }}
        value={pinValue}
        onChangeText={(text) => {
          setPinValue(text);
          onPinCodeChange?.(text);
          if (text.length === PIN_CELL_COUNT && !disabledComplete) {
            onComplete?.();
          }
        }}
        cellCount={PIN_CELL_COUNT}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        renderCell={renderCell}
      />
      {showMask ? (
        <IconButton
          icon={enableMask ? 'EyeOutline' : 'EyeOffOutline'}
          onPress={toggleMask}
        />
      ) : null}
    </XStack>
  );
};

export default PassCodeInput;
