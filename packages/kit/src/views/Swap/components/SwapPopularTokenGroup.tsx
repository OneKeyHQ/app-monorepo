import { memo } from 'react';

import { StyleSheet } from 'react-native';

import { Image, SizableText, XStack } from '@onekeyhq/components';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapPopularTokenGroupProps {
  onSelectToken: (token: ISwapToken) => void;
  selectedToken?: ISwapToken;
  tokens: ISwapToken[];
}

const SwapPopularTokenGroup = ({
  onSelectToken,
  selectedToken,
  tokens,
}: ISwapPopularTokenGroupProps) => (
  <XStack pt="$1" pb="$3" gap="$1.5" flexWrap="wrap">
    {tokens.map((token) => (
      <XStack
        key={token.contractAddress}
        role="button"
        userSelect="none"
        alignItems="center"
        px="$1.5"
        py="$1"
        bg="$bg"
        borderRadius="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
          outlineOffset: 2,
        }}
        disabled={
          !!equalTokenNoCaseSensitive({
            token1: selectedToken,
            token2: token,
          })
        }
        onPress={() => {
          onSelectToken(token);
        }}
        disabledStyle={{
          opacity: 0.5,
        }}
      >
        <Image height="$4.5" width="$4.5" borderRadius="$full">
          <Image.Source
            source={{
              uri: token.logoURI,
            }}
          />
        </Image>
        <SizableText pl="$1" size="$bodyLgMedium">
          {token.symbol}
        </SizableText>
      </XStack>
    ))}
  </XStack>
);

export default memo(SwapPopularTokenGroup);
