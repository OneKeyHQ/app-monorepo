import React, { FC, useEffect, useRef, useState } from 'react';

import { Animated, Text, View } from 'react-native';
import RNTypeWriter from 'react-native-typewriter';

import { useThemeValue } from '../Provider/hooks';

const [lineHeight, fontSize] = [56, 48];

type NormalTextProps = { fadeOut?: boolean };

export const NormalText: FC<NormalTextProps> = ({ children, fadeOut }) => {
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  const color = useThemeValue('text-default');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text style={{ opacity: fadeOutAnim, color }}>
      {children}
    </Animated.Text>
  );
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

type TypeWriterProps = { pending?: boolean; onTypingEnd?: () => void };

export const TypeWriter: FC<TypeWriterProps> = ({
  children,
  onTypingEnd,
  pending,
}) => {
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (!pending) {
      setTimeout(() => {
        setStart(true);
      }, 650);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ minHeight: lineHeight }}>
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
          {children}
        </RNTypeWriter>
      ) : (
        <Caret />
      )}
    </View>
  );
};
