import { memo } from 'react';

import { Image, SizableText, Spinner, XStack } from '@onekeyhq/components';

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
}: ISwapTokenSelectProps) =>
  loading ? (
    <Spinner justifyContent="center" alignItems="center" />
  ) : (
    <XStack
      borderWidth="$1"
      onPress={onSelectTokenTrigger}
      alignItems="center"
      px="$2"
    >
      {currentToken ? (
        <>
          <Image
            borderRadius="$5"
            w="$10"
            h="$10"
            mr="$2"
            source={{ uri: currentToken.logoURI }}
            // resizeMode="center"
          />
          <SizableText>{currentToken.symbol}</SizableText>
        </>
      ) : (
        <SizableText>请选择 token</SizableText>
      )}
    </XStack>
  );

export default memo(SwapTokenSelectTrigger);
