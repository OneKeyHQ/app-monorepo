import React, { FC } from 'react';

import { Input } from '@onekeyhq/components';

export const AutoSizeText: FC<{
  text: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
}> = ({ text, onChangeText, placeholder }) => (
  <Input
    flex={1}
    height="112"
    size="xl"
    textAlign="center"
    borderWidth="0"
    fontSize="40px"
    placeholder={placeholder}
    placeholderTextColor="text-disabled"
    lineHeight="64px"
    fontWeight="bold"
    bgColor="surface-subdued"
    onChangeText={onChangeText}
    value={text}
  />
);
