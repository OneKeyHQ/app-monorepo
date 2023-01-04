import type { ComponentProps, FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Animated, StyleSheet } from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

import { useTheme, useThemeValue } from '@onekeyhq/components';

import type { View } from 'react-native';
import type { RenderCellOptions } from 'react-native-confirmation-code-field';

const CELL_SIZE = 42;
const CELL_BORDER_RADIUS = 12;

const { Value, Text: AnimatedText } = Animated;

type PinCodeProps = {
  count?: number;
  autoFocus?: boolean;
  containerStyle?: ComponentProps<typeof View>['style'];
  onCodeCompleted?: (c: string) => Promise<boolean | void | string> | void;
  onCodeNext?: (c: string) => void;
  errorMessage?: string;
};

const PinCode: FC<PinCodeProps> = ({
  count = 6,
  containerStyle,
  autoFocus,
  onCodeCompleted,
  onCodeNext,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const ref = useBlurOnFulfill({ value, cellCount: count });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  const { themeVariant } = useTheme();
  const [bgColor, activeBgColor, borderColor, emptyBgColor, errorColor] =
    useThemeValue([
      'action-primary-default',
      'focused-default',
      'border-default',
      'action-secondary-default',
      'border-critical-default',
    ]);

  const { animationsColor, animationsScale } = useMemo(() => {
    const color = [...new Array(count)].map(() => new Value(0));
    const scale = [...new Array(count)].map(() => new Value(1));
    return {
      animationsColor: color,
      animationsScale: scale,
    };
  }, [count]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        codeFieldRoot: {
          height: CELL_SIZE,
          justifyContent: 'center',
        },
        cell: {
          marginHorizontal: 8,
          height: CELL_SIZE,
          width: CELL_SIZE,
          lineHeight: CELL_SIZE,
          fontSize: 24,
          textAlign: 'center',
          alignItems: 'center',
          borderRadius: CELL_BORDER_RADIUS,
          overflow: 'hidden',
          color: activeBgColor,

          // IOS
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.22,
          shadowRadius: 2.22,

          // Android
          elevation: 3,
        },
      }),
    [activeBgColor],
  );

  const animateCell = ({
    hasValue,
    index,
    isFocused,
  }: {
    hasValue: boolean;
    index: number;
    isFocused: boolean;
  }) => {
    Animated.parallel([
      Animated.timing(animationsColor[index], {
        useNativeDriver: false,
        toValue: isFocused ? 1 : 0,
        duration: 250,
      }),
      Animated.spring(animationsScale[index], {
        useNativeDriver: false,
        toValue: hasValue ? 0 : 1,
        // duration: hasValue ? 300 : 250,
      }),
    ]).start();
  };

  const renderCell = ({ index, symbol, isFocused }: RenderCellOptions) => {
    const hasValue = Boolean(symbol);
    const animatedCellStyle = {
      borderWidth: hasValue ? 0 : 1,
      // eslint-disable-next-line no-nested-ternary
      borderColor: error ? errorColor : isFocused ? activeBgColor : borderColor,
      backgroundColor: hasValue
        ? animationsScale[index].interpolate({
            inputRange: [0, 1],
            outputRange: [bgColor, activeBgColor],
          })
        : animationsColor[index].interpolate({
            inputRange: [0, 1],
            outputRange: [emptyBgColor, emptyBgColor],
          }),
      borderRadius: animationsScale[index].interpolate({
        inputRange: [0, 1],
        outputRange: [CELL_SIZE, CELL_BORDER_RADIUS],
      }),
      transform: [
        {
          scale: animationsScale[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 1],
          }),
        },
      ],
    };

    setTimeout(() => {
      animateCell({ hasValue, index, isFocused });
    }, 0);

    return (
      <AnimatedText
        key={index}
        style={[styles.cell, animatedCellStyle]}
        onLayout={getCellOnLayoutHandler(index)}
      >
        {symbol || (isFocused ? <Cursor /> : null)}
      </AnimatedText>
    );
  };

  useEffect(() => {
    if (!autoFocus) return;
    const inputRef = ref.current;
    const timeoutId = setTimeout(() => inputRef?.focus?.(), 550);

    return () => {
      clearTimeout(timeoutId);
      inputRef?.blur();
    };
  }, [autoFocus, ref]);

  useEffect(() => {
    async function main() {
      if (value.length === 1 && error) {
        setError(false);
      }
      if (value.length === count) {
        if (onCodeCompleted && typeof onCodeCompleted === 'function') {
          const status = await onCodeCompleted?.(value);
          if (status === false) {
            setValue('');
            return setError(true);
          }
          if (status === '') {
            return setValue('');
          }
        }
        onCodeNext?.(value);
      }
    }
    main();
  }, [value, onCodeCompleted, onCodeNext, count, error]);

  return (
    <CodeField
      ref={ref}
      {...props}
      keyboardAppearance={themeVariant}
      value={value}
      onChangeText={setValue}
      cellCount={count}
      rootStyle={[styles.codeFieldRoot, containerStyle]}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      renderCell={renderCell}
    />
  );
};

export default PinCode;
