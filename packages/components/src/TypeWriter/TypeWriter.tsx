import React, { FC, useEffect, useMemo, useRef, useState } from 'react';

import { Animated, Text } from 'react-native';
import RNTypeWriter from 'react-native-typewriter';

import { useThemeValue } from '../Provider/hooks';

const [lineHeight, fontSize] = [56, 48];

export const NormalText: FC = ({ children }) => {
  const color = useThemeValue('text-default');
  return <Text style={{ color }}>{children}</Text>;
};

export const Highlight: FC = ({ children }) => {
  const highlightColor = useThemeValue('interactive-default');
  return <Text style={{ color: highlightColor }}>{children}</Text>;
};

export const Caret: FC = () => {
  const TypingAnim = useRef(new Animated.Value(0)).current;
  const highlightColor = useThemeValue('interactive-default');
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(TypingAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(TypingAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [TypingAnim]);

  return (
    <Animated.View
      style={{
        width: 32,
        height: lineHeight,
        borderBottomWidth: 4,
        borderBottomColor: highlightColor,
        opacity: TypingAnim,
      }}
    />
  );
};

type TypeWriterProps = {
  isPending?: boolean;
  onTypingEnd?: () => void;
  fadeOut?: boolean;
};

export const TypeWriter: FC<TypeWriterProps> = ({
  children,
  onTypingEnd,
  isPending = true,
  fadeOut,
}) => {
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (fadeOut) {
      const animation = Animated.timing(fadeOutAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: false,
      });
      setTimeout(() => {
        animation.start();
      }, 150);
    }
  }, [fadeOut, fadeOutAnim]);

  const [start, setStart] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setTimeout(() => {
        setStart(true);
      }, 650);
    }
  }, [isPending]);

  // eslint-disable-next-line
  const memo = useMemo(() => children, []);

  return (
    <Animated.View style={{ minHeight: lineHeight, opacity: fadeOutAnim }}>
      {start ? (
        <RNTypeWriter
          typing={1}
          style={{
            color: '#E2E2E8',
            fontSize,
            lineHeight,
            fontWeight: 'bold',
          }}
          initialDelay={0}
          minDelay={12}
          maxDelay={12}
          onTypingEnd={onTypingEnd}
        >
          {memo}
        </RNTypeWriter>
      ) : (
        <Caret />
      )}
    </Animated.View>
  );
};
