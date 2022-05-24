import React, { FC } from 'react';

import { useIntl } from 'react-intl';
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
  const intl = useIntl();
  const innerText =
    text.length === 0 ? intl.formatMessage({ id: 'content__amount' }) : text;
  if (text.length > 0) {
    return (
      <ASText
        style={{
          color: themeVariant === 'dark' ? '#E2E2E8' : '#1F1F38',
        }}
        fontSize={64}
        numberOfLines={1}
        mode={ResizeTextMode.max_lines}
      >
        {innerText}
      </ASText>
    );
  }
  return (
    <Text fontSize={64} lineHeight={72} fontWeight="700" color="text-disabled">
      {innerText}
    </Text>
  );
};
