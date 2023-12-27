import { Image, Skeleton, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ImageGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'load Image via source',
        element: (
          <YStack space={10}>
            <Image
              height="$10"
              width="$10"
              source={require('../../../../../../../assets/walletLogo/cosmos_keplr.png')}
            />
            <Image
              height="$10"
              width="$10"
              source={{
                uri: 'https://onekey-asset.com/assets/btc/btc.png',
              }}
            />
          </YStack>
        ),
      },
      {
        title: 'load Image via src',
        element: (
          <YStack space={10}>
            <Image
              height="$10"
              width="$10"
              src="https://onekey-asset.com/assets/btc/btc.png"
            />
          </YStack>
        ),
      },
      {
        title: 'Loading Fallback',
        element: (
          <YStack space={10}>
            <Image height="$10" width="$10">
              <Image.Source
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/btc.png',
                }}
              />
              <Image.Fallback>
                <Skeleton width="100%" height="100%" />
              </Image.Fallback>
            </Image>
            <Image height="$10" width="$10">
              <Image.Source
                delayMs={2500}
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/btc.png',
                }}
              />
              <Image.Fallback>
                <Skeleton width="100%" height="100%" />
              </Image.Fallback>
            </Image>

            <Image height="$10" width="$10">
              <Image.Source
                delayMs={2500}
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/btc.png',
                }}
              />
              <Image.Skeleton />
            </Image>
            <Image height="$10" width="$10">
              <Image.Source
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/btc.png',
                }}
              />
              <Image.Fallback delayMs={2500}>
                <Skeleton width="100%" height="100%" />
              </Image.Fallback>
            </Image>
          </YStack>
        ),
      },

      {
        title: 'Loading Fallback',
        element: (
          <YStack>
            <Image height="$10" width="$10">
              <Image.Source
                delayMs={2500}
                src="https://onekey-asset.com/assets/btc/btc.png"
              />
              <Image.Skeleton />
            </Image>
          </YStack>
        ),
      },
    ]}
  />
);

export default ImageGallery;
