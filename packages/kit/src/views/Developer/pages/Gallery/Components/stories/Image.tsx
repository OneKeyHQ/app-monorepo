import { Icon, Image, Skeleton, YStack } from '@onekeyhq/components';

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
              source={require('@onekeyhq/kit/assets/walletLogo/cosmos_keplr.png')}
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
              <Image.Fallback>
                <Icon name="ImageMountainsOutline" size="$8" />
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
          <YStack space="$4">
            <Image height="$10" width="$10">
              <Image.Source
                delayMs={2500}
                src="https://onekey-asset.com/assets/btc/btc.png"
              />
              <Image.Skeleton />
            </Image>
            <Image
              size="$14"
              borderRadius="$3"
              $gtLg={{
                w: '$12',
                h: '$12',
              }}
            >
              <Image.Source
                source={{
                  uri: 'https://dev.onekey-asset.com/dashboard/dapp/upload_1706684476225.0.17899416707349025.0.jpeg',
                }}
              />
              <Image.Fallback>
                <Icon
                  size="$14"
                  $gtLg={{
                    size: '$12',
                  }}
                  name="GlobusOutline"
                />
              </Image.Fallback>
            </Image>
          </YStack>
        ),
      },
      {
        title: 'onError',
        element: (
          <YStack space="$4">
            <Image height="$10" width="$10">
              <Image.Source src="https://onekey-asset.com/assets/btc/bt" />
              <Image.Skeleton />
            </Image>
            <Image
              size="$14"
              borderRadius="$3"
              $gtLg={{
                w: '$12',
                h: '$12',
              }}
            >
              <Image.Source
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/bt',
                }}
              />
              <Image.Fallback>
                <Icon
                  size="$14"
                  $gtLg={{
                    size: '$12',
                  }}
                  name="GlobusOutline"
                />
              </Image.Fallback>
            </Image>
            <Image
              size="$14"
              borderRadius="$3"
              delayMs={10 * 1000}
              $gtLg={{
                w: '$12',
                h: '$12',
              }}
            >
              <Image.Source
                source={{
                  uri: 'https://onekey-asset.com/assets/btc/bt',
                }}
              />
              <Image.Fallback>
                <Icon
                  size="$14"
                  $gtLg={{
                    size: '$12',
                  }}
                  name="GlobusOutline"
                />
              </Image.Fallback>
              <Image.Loading>
                <Skeleton width="100%" height="100%" />
              </Image.Loading>
            </Image>
          </YStack>
        ),
      },
    ]}
  />
);

export default ImageGallery;
