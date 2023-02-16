import type { FC } from 'react';

import {
  AutoSizeText as ASText,
  ResizeTextMode,
} from 'react-native-auto-size-text';

import { Text, useThemeValue } from '@onekeyhq/components';

export const AutoSizeText: FC<{
  text: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  autoFocus?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}> = ({ text, onChangeText, placeholder, autoFocus }) => {
  const innerText = text.length === 0 ? placeholder : text;

  const textColor = useThemeValue('text-default');
  if (text.length > 0) {
    return (
      <ASText
        style={{
          color: textColor,
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
