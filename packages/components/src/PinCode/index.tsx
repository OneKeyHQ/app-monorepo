import React, { ComponentProps, FC, useEffect, useMemo, useState } from 'react';

import { Animated, InteractionManager, StyleSheet, View } from 'react-native';
import {
  CodeField,
  Cursor,
  RenderCellOptions,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

import { useThemeValue } from '../Provider/hooks';

const CELL_SIZE = 42;
const CELL_BORDER_RADIUS = 12;

const { Value, Text: AnimatedText } = Animated;

type PinCodeProps = {
  count?: number;
  autoFocus?: boolean;
  containerStyle?: ComponentProps<typeof View>['style'];
  onCodeCompleted?: (c: string) => Promise<boolean | void>;
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
  const ref = useBlurOnFulfill({ value, cellCount: count });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  const [bgColor, activeBgColor, borderColor] = useThemeValue([
    'action-primary-default',
    'focused-default',
    'border-default',
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
      borderColor: isFocused ? activeBgColor : borderColor,
      backgroundColor: hasValue
        ? animationsScale[index].interpolate({
            inputRange: [0, 1],
            outputRange: [bgColor, activeBgColor],
          })
        : animationsColor[index].interpolate({
            inputRange: [0, 1],
            outputRange: ['#262631', '#262631'],
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
    let timeoutId: ReturnType<typeof setTimeout>;
    const interactionPromise = InteractionManager.runAfterInteractions(
      () => (timeoutId = setTimeout(() => inputRef?.focus?.(), 550)),
    );
    return () => {
      clearTimeout(timeoutId);
      interactionPromise.cancel();
      inputRef?.blur();
    };
  }, [autoFocus, ref]);

  useEffect(() => {
    async function main() {
      if (value.length === count) {
        if (onCodeCompleted && typeof onCodeCompleted === 'function') {
          const status = await onCodeCompleted?.(value);
          if (status === false) return setValue('');
        }
        onCodeNext?.(value);
      }
    }
    main();
  }, [value, onCodeCompleted, onCodeNext, count]);

  return (
    <CodeField
      ref={ref}
      {...props}
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
