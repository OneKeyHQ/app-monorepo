import { memo } from 'react';

import { StyleSheet } from 'react-native';

import { Image, SizableText, XStack } from '@onekeyhq/components';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapPopularTokenGroupProps {
  onSelectToken: (token: ISwapToken) => void;
  tokens: ISwapToken[];
  variant?: 'default' | 'desktop';
}

const SwapPopularTokenGroup = ({
  onSelectToken,
  tokens,
  variant = 'default',
}: ISwapPopularTokenGroupProps) => (
  <XStack
    pt={variant === 'desktop' ? '$1.5' : '$1'}
    pb={variant === 'desktop' ? '$2' : '$3'}
    gap={variant === 'desktop' ? '$2' : '$1.5'}
    flexWrap="wrap"
  >
    {tokens.map((token) => (
      <XStack
        key={token.contractAddress}
        role="button"
        userSelect="none"
        alignItems="center"
        px={variant === 'desktop' ? '$2' : '$1.5'}
        height={variant === 'desktop' ? 36 : undefined}
        py="$1"
        bg="$bg"
        borderRadius={variant === 'desktop' ? '$full' : '$4'}
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
        onPress={() => {
          onSelectToken(token);
        }}
        disabledStyle={{
          opacity: 0.5,
        }}
      >
        <Image
          size={variant === 'desktop' ? '$5' : '$4.5'}
          borderRadius="$full"
          source={{
            uri: token.logoURI,
          }}
        />
        <SizableText
          pl={variant === 'desktop' ? '$1.5' : '$1'}
          size={variant === 'desktop' ? '$bodyMdMedium' : '$bodyLgMedium'}
        >
          {token.symbol}
        </SizableText>
      </XStack>
    ))}
  </XStack>
);

export default memo(SwapPopularTokenGroup);
