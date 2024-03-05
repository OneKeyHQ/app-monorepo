import { YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

const tokenImageUri = 'https://onekey-asset.com/assets/btc/btc.png';
const TokenGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'size',
        element: (
          <YStack space="$3">
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
          <YStack space="$3">
            <Token size="md" isNFT tokenImageUri={tokenImageUri} />
          </YStack>
        ),
      },
      {
        title: 'chainImageUri',
        element: (
          <YStack space="$3">
            <Token
              size="md"
              chainImageUri={tokenImageUri}
              tokenImageUri={tokenImageUri}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default TokenGallery;
