import { SizableText, YStack } from '@onekeyhq/components';
import { Token, TokenGroup } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

const blackTokenImageUri =
  'https://coin-images.coingecko.com/coins/images/26580/large/ONDO.png';
const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/btc.png';
const evmTokenImageUri =
  'https://common.onekey-asset.com/token/evm-1/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0.jpg';
const ethTokenImageUri = 'https://uni.onekey-asset.com/static/chain/eth.png';
const solTokenImageUri = 'https://uni.onekey-asset.com/static/chain/sol.png';

const mockTokens = [
  { tokenImageUri },
  { tokenImageUri: ethTokenImageUri },
  { tokenImageUri: solTokenImageUri },
  { tokenImageUri: evmTokenImageUri },
  { tokenImageUri: blackTokenImageUri },
];
const TokenGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Token"
    elements={[
      {
        title: 'size',
        element: (
          <YStack gap="$3">
            <Token size="xs" tokenImageUri={tokenImageUri} />
            <Token size="sm" tokenImageUri={tokenImageUri} />
            <Token size="md" tokenImageUri={tokenImageUri} />
            <Token size="lg" tokenImageUri={tokenImageUri} />
            <Token size="xl" tokenImageUri={tokenImageUri} />
          </YStack>
        ),
      },
      {
        title: 'isNFT',
        element: (
          <YStack gap="$3">
            <Token size="md" tokenImageUri={evmTokenImageUri} />
            <Token size="md" isNFT tokenImageUri={evmTokenImageUri} />
            <Token size="md" isNFT={false} tokenImageUri={evmTokenImageUri} />
          </YStack>
        ),
      },
      {
        title: 'networkImageUri',
        element: (
          <YStack gap="$3">
            <Token
              size="md"
              networkImageUri={tokenImageUri}
              tokenImageUri={tokenImageUri}
            />
          </YStack>
        ),
      },
      {
        title: 'black icon',
        element: (
          <Token
            size="md"
            networkImageUri={blackTokenImageUri}
            tokenImageUri={blackTokenImageUri}
          />
        ),
      },
      {
        title: 'TokenGroup - sizes',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              xs
            </SizableText>
            <TokenGroup tokens={mockTokens.slice(0, 3)} size="xs" />
            <SizableText size="$bodySm" color="$textSubdued">
              sm
            </SizableText>
            <TokenGroup tokens={mockTokens.slice(0, 3)} size="sm" />
            <SizableText size="$bodySm" color="$textSubdued">
              md
            </SizableText>
            <TokenGroup tokens={mockTokens.slice(0, 3)} size="md" />
            <SizableText size="$bodySm" color="$textSubdued">
              lg
            </SizableText>
            <TokenGroup tokens={mockTokens.slice(0, 3)} size="lg" />
          </YStack>
        ),
      },
      {
        title: 'TokenGroup - maxVisible',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              5 tokens, maxVisible=3
            </SizableText>
            <TokenGroup tokens={mockTokens} maxVisible={3} size="sm" />
            <SizableText size="$bodySm" color="$textSubdued">
              5 tokens, maxVisible=2
            </SizableText>
            <TokenGroup tokens={mockTokens} maxVisible={2} size="sm" />
          </YStack>
        ),
      },
      {
        title: 'TokenGroup - variants',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              overlapped (default)
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              variant="overlapped"
              size="sm"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              spread
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              variant="spread"
              size="sm"
            />
          </YStack>
        ),
      },
      {
        title: 'TokenGroup - wrapperStyle',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              background (default)
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              wrapperStyle="background"
              size="sm"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              border
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              wrapperStyle="border"
              wrapperBorderColor="$borderSubdued"
              size="sm"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              none
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              wrapperStyle="none"
              size="sm"
            />
          </YStack>
        ),
      },
      {
        title: 'TokenGroup - overlapOffset',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              offset: $-2 (less overlap)
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              overlapOffset="$-2"
              size="sm"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              offset: $-4 (more overlap)
            </SizableText>
            <TokenGroup
              tokens={mockTokens.slice(0, 3)}
              overlapOffset="$-4"
              size="sm"
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default TokenGallery;
