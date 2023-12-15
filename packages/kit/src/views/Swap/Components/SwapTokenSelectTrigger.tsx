import { memo } from 'react';

import { Spinner } from 'tamagui';

import { Image, Text, XStack } from '@onekeyhq/components';

import type { ISwapToken } from '../types';

interface ISwapTokenSelectProps {
  onSelectTokenTrigger: () => void;
  currentToken?: ISwapToken;
  loading?: boolean;
}

const SwapTokenSelectTrigger = ({
  currentToken,
  loading,
  onSelectTokenTrigger,
}: ISwapTokenSelectProps) => {
  console.log('SwapTokenSelectTrigger');
  return loading ? (
    <Spinner />
  ) : (
    <XStack borderWidth="$1" onPress={onSelectTokenTrigger}>
      {currentToken ? (
        <>
          <Image source={{ uri: currentToken.logoURI }} />
          <Text>{currentToken.symbol}</Text>
        </>
      ) : (
        <Text>请选择 token</Text>
      )}
    </XStack>
  );
};

export default memo(SwapTokenSelectTrigger);
