import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Input } from '@onekeyhq/components';

export const AutoSizeText: FC<{
  text: string;
  onChangeText?: (text: string) => void;
}> = ({ text, onChangeText }) => {
  const intl = useIntl();
  return (
    <Input
      flex={1}
      height="112"
      size="xl"
      textAlign="center"
      borderWidth="0"
      fontSize="40px"
      placeholder={intl.formatMessage({ id: 'content__amount' })}
      placeholderTextColor="text-disabled"
      lineHeight="64px"
      fontWeight="bold"
      bgColor="surface-subdued"
      multiline
      onChangeText={onChangeText}
      value={text}
    />
  );
};
