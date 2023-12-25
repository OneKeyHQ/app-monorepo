import { QRCode, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const QRCodeGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <YStack justifyContent="center" flex={1} space="$4">
            <QRCode value="https://onekey.so/" size={296} />
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
    ]}
  />
);

export default QRCodeGallery;
