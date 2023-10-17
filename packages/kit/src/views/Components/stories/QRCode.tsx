import { QRCode, XStack } from '@onekeyhq/components';

const QRCodeGallery = () => (
  <XStack justifyContent="center">
    <QRCode value="https://onekey.so/" size={296} />
  </XStack>
);

export default QRCodeGallery;
