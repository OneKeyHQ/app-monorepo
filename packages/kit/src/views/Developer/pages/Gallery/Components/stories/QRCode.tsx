import { QRCode, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const QRCodeGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'this logo is came from internet.',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode value="https://onekey.so/" size={200} />
          </YStack>
        ),
      },
      {
        title: 'this logo is came from internet.',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode
              logo={{
                uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
              }}
              value="https://onekey.so/"
              size={200}
            />
            <QRCode
              logo={{
                uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
              }}
              logoBackgroundColor="bgStrongActive"
              value="https://onekey.so/"
              size={200}
            />
          </YStack>
        ),
      },
      {
        title: 'this logo is came from local source.',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode
              logo={require('@onekeyhq/kit/assets/logo.png')}
              value="https://onekey.so/"
              size={200}
            />
            <QRCode
              logo={require('@onekeyhq/kit/assets/logo.png')}
              logoBackgroundColor="bgStrongActive"
              value="https://onekey.so/"
              size={200}
            />
          </YStack>
        ),
      },
      {
        title: 'this logo is came from svg.',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode
              value="https://onekey.so/"
              logoSvg="OnekeyBrand"
              size={200}
            />
            <QRCode
              value="https://onekey.so/"
              logoSvg="OnekeyBrand"
              logoSvgColor="$bgStrongActive"
              size={200}
            />
          </YStack>
        ),
      },
      {
        title: 'dynimic qrcode',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode
              value={JSON.stringify(
                new Array(200).fill(0).map((_, index) => index),
              )}
              size={200}
              interval={300}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default QRCodeGallery;
