import { YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/btc.png';
const evmTokenImageUri =
  'https://common.onekey-asset.com/token/evm-1/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0.jpg';
const TokenGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
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
    ]}
  />
);

export default TokenGallery;
