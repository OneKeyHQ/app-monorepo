import React, { FC } from 'react';

import {
  AutoSizeText as ASText,
  ResizeTextMode,
} from 'react-native-auto-size-text';

import { Text, useTheme } from '@onekeyhq/components';

export const AutoSizeText: FC<{
  text: string;
  onChangeText?: (text: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}> = ({ text, onChangeText }) => {
  const { themeVariant } = useTheme();
  const innerText = text.length === 0 ? '0' : text;
  if (text.length > 0) {
    return (
      <ASText
        style={{
          color: themeVariant === 'dark' ? '#E2E2E8' : '#1F1F38',
          fontWeight: 'bold',
        }}
        fontSize={64}
        minimumFontScale={0.375}
        numberOfLines={1}
        mode={ResizeTextMode.max_lines}
      >
        {innerText}
      </ASText>
    );
  }
  return (
    <Text fontSize={64} lineHeight={64} fontWeight="bold" color="text-disabled">
      {innerText}
    </Text>
  );
};
