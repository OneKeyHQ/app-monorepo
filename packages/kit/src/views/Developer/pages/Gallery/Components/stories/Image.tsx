import { Icon, Image, Skeleton, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const base64Image =
  '\ndata:image/png;base64,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\n';
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
                uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
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
              src="https://uni.onekey-asset.com/static/chain/btc.png"
            />
          </YStack>
        ),
      },
      {
        title: 'uri is empty string',
        element: (
          <YStack space={10}>
            <Image w="$5" h="$5">
              <Image.Source
                source={{
                  uri: '',
                }}
              />
            </Image>
          </YStack>
        ),
      },
      {
        title: 'base64 Image',
        element: (
          <YStack space={10}>
            <Image size="$10" source={{ uri: base64Image }} />
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
                  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
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
                  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
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
                  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
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
                  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
                }}
              />
              <Image.Skeleton />
            </Image>
            <Image height="$10" width="$10">
              <Image.Source
                source={{
                  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
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
                src="https://uni.onekey-asset.com/static/chain/btc.png"
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
              $gtLg={{
                w: '$12',
                h: '$12',
              }}
            >
              <Image.Source
                delayMs={10 * 1000}
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
