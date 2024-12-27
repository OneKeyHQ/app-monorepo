import { useEffect, useState } from 'react';

import { StyleSheet, Text } from 'react-native';
import {
  CodeField,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

import { YStack } from '@onekeyhq/components';

export const PIN_CELL_COUNT = 6;

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

  const cellStyles = StyleSheet.create({
    cell: {
      width: 16,
      height: 16,
    },
  });

  const renderCell = ({
    index,
    symbol,
    isFocused,
  }: {
    index: number;
    symbol: string;
    isFocused: boolean;
  }) => (
    // let textChild = null;
    // if (symbol) {
    //   textChild = enableMask ? '•' : symbol;
    // }

    <Text
      key={index}
      style={[...[cellStyles.cell]]}
      onLayout={getCellOnLayoutHandler(index)}
    >
      {/* {symbol ? (
          <YStack w="$4" h="$4" borderRadius="$full" bg="$borderActive" />
        ) : (
          ''
        )} */}
      <YStack
        animation="50ms"
        w="$4"
        h="$4"
        backgroundColor={symbol ? '$borderActive' : '$transparent'}
        borderWidth={1}
        borderRadius="$full"
        borderColor="$borderActive"
      />
    </Text>
  );
  useEffect(() => {
    if (pinCodeFocus) {
      pinInputRef.current?.focus();
    }
  }, [pinCodeFocus, pinInputRef]);

  return (
    <CodeField
      autoFocus={enableAutoFocus}
      testID={testId}
      ref={pinInputRef}
      rootStyle={{
        flex: 1,
        paddingVertical: 32,
        alignSelf: 'center',
        width: 200,
      }}
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
      {...props}
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
};

export default PassCodeInput;
