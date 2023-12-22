import { memo } from 'react';

import { Avatar, Image, Spinner, Text, XStack } from '@onekeyhq/components';

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
          <Avatar size="$10" borderRadius="$5" mr="$2">
            <Image
              flex={1}
              width="100%"
              source={{ uri: currentToken.logoURI }}
              resizeMode="center"
            />
          </Avatar>

          <Text>{currentToken.symbol}</Text>
        </>
      ) : (
        <Text>请选择 token</Text>
      )}
    </XStack>
  );

export default memo(SwapTokenSelectTrigger);
