import { QRCode, XStack } from '@onekeyhq/components';

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
          <XStack justifyContent="center" flex={1}>
            <QRCode value="https://onekey.so/" size={296} />
          </XStack>
        ),
      },
    ]}
  />
);

export default QRCodeGallery;
