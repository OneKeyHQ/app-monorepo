import { memo } from 'react';

import { Button, Image, SizableText, XStack } from '@onekeyhq/components';
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
      <Button
        key={token.contractAddress}
        variant="secondary"
        borderRadius="$4"
        px="$1.5"
        size="small"
        borderColor="$borderSubdued"
        flexDirection="row"
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
        disabled={
          !!equalTokenNoCaseSensitive({
            token1: selectedToken,
            token2: token,
          })
        }
        onPress={() => {
          onSelectToken(token);
        }}
      >
        <XStack justifyContent="center" gap="$1" alignItems="center" flex={1}>
          <Image height="$4.5" width="$4.5" borderRadius="$full">
            <Image.Source
              source={{
                uri: token.logoURI,
              }}
            />
          </Image>
          <SizableText size="$bodyLgMedium">{token.symbol}</SizableText>
        </XStack>
      </Button>
    ))}
  </XStack>
);

export default memo(SwapPopularTokenGroup);
