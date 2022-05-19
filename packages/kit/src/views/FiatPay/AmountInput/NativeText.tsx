/* eslint-disable global-require, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires */
import React, { FC } from 'react';

import { Text, useTheme } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let AutoSizeText:
  | typeof import('react-native-auto-size-text').AutoSizeText
  | undefined;
try {
  AutoSizeText = require('react-native-auto-size-text').AutoSizeText;
} catch (e) {
  // Ignore
  console.debug('Error on require `react-native-auto-size-text` module', e);
}

let ResizeTextMode:
  | typeof import('react-native-auto-size-text').ResizeTextMode
  | undefined;
try {
  ResizeTextMode = require('react-native-auto-size-text').ResizeTextMode;
} catch (e) {
  // Ignore
  console.debug('Error on require `react-native-auto-size-text` module', e);
}

export const NativeText: FC<{ text: string }> = ({ text }) => {
  const { themeVariant } = useTheme();
  const innerText = text.length === 0 ? 'Amount' : text;
  if (text.length > 0) {
    if (platformEnv.isNative && !!AutoSizeText && !!ResizeTextMode) {
      return (
        <AutoSizeText
          style={{
            color: themeVariant === 'dark' ? '#E2E2E8' : '#1F1F38',
          }}
          fontSize={64}
          numberOfLines={1}
          mode={ResizeTextMode.max_lines}
        >
          {innerText}
        </AutoSizeText>
      );
    }
  }
  return (
    <Text fontSize={64} lineHeight={72} fontWeight="700" color="text-disabled">
      {innerText}
    </Text>
  );
};
