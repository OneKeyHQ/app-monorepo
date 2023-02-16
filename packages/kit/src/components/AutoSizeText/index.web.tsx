import type { FC } from 'react';

import { Input } from '@onekeyhq/components';

export const AutoSizeText: FC<{
  text: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  autoFocus?: boolean;
}> = ({ text, onChangeText, placeholder, autoFocus }) => (
  <Input
    autoFocus={autoFocus}
    flex={1}
    height="112"
    size="xl"
    textAlign="center"
    borderWidth="0"
    fontSize="40px"
    placeholder={placeholder}
    placeholderTextColor="text-disabled"
    focusOutlineColor="transparent"
    lineHeight="64px"
    fontWeight="bold"
    bgColor="transparent"
    onChangeText={onChangeText}
    value={text}
  />
);
