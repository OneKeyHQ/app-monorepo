import { QRCode, YStack } from '@onekeyhq/components';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
              logoSvgColor="$bgCriticalStrong"
              size={200}
            />
          </YStack>
        ),
      },
      {
        title: 'DrawType',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode drawType="line" value="https://onekey.so/" size={200} />
            <QRCode drawType="line" value="https://onekey.so/" size={200} />
          </YStack>
        ),
      },
      {
        title: 'Animated QR',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode
              drawType="animated"
              valueUr={{
                type: '1',
                cbor: bufferUtils.textToHex(
                  "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
                ),
              }}
              size={200}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default QRCodeGallery;
