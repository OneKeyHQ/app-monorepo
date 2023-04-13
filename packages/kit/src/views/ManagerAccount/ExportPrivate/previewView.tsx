import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Image,
  QRCode,
  Spinner,
  Text,
  ToastManager,
  ZStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import BlurQRCode from '@onekeyhq/kit/assets/blur-qrcode.png';
import QrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';

type ISize = { base: number; md: number };
export const QRLoadingView: FC<{
  qrCodeContainerSize: ISize;
}> = ({ qrCodeContainerSize }) => (
  <ZStack w={qrCodeContainerSize} h={qrCodeContainerSize}>
    <Image
      borderRadius="24px"
      source={BlurQRCode}
      w={qrCodeContainerSize}
      h={qrCodeContainerSize}
    />
    <Center w="100%" h="100%">
      <Spinner />
    </Center>
  </ZStack>
);

export const PrivateOrPublicKeyPreview: FC<{
  privateOrPublicKey?: string;
  qrCodeContainerSize: ISize;
}> = ({ privateOrPublicKey, qrCodeContainerSize }) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();

  const copyDataToClipboard = useCallback(() => {
    copyToClipboard(privateOrPublicKey ?? '');
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [privateOrPublicKey, intl]);

  return (
    <Box py="24px" justifyContent="center" flexDirection="column">
      <Box
        minH={qrCodeContainerSize}
        alignItems="center"
        flexDirection="column"
      >
        {privateOrPublicKey ? (
          <Box
            borderRadius="24px"
            bgColor="#FFFFFF"
            p={isSmallScreen ? '16px' : '11px'}
            shadow="depth.4"
          >
            {!!privateOrPublicKey && (
              <QRCode
                value={privateOrPublicKey}
                logo={QrcodeLogo}
                size={isSmallScreen ? 264 : 186}
                logoSize={isSmallScreen ? 57 : 40}
                logoMargin={isSmallScreen ? 4 : 2}
                logoBackgroundColor="white"
              />
            )}
          </Box>
        ) : (
          <QRLoadingView qrCodeContainerSize={qrCodeContainerSize} />
        )}
      </Box>
      <Box
        alignItems="center"
        mt={isSmallScreen ? '32px' : '24px'}
        px={isSmallScreen ? '24px' : '32px'}
      >
        <Text
          color="text-subdued"
          textAlign="center"
          typography={{ sm: 'Body1', md: 'Body2' }}
          w="full"
          maxW="full"
        >
          {privateOrPublicKey}
        </Text>
        <Button
          width={isSmallScreen ? '188px' : '154px'}
          height={isSmallScreen ? '48px' : '36px'}
          mt={isSmallScreen ? '32px' : '24px'}
          type="plain"
          size={isSmallScreen ? 'xl' : 'base'}
          leftIconName="Square2StackMini"
          onPress={copyDataToClipboard}
          isLoading={!privateOrPublicKey}
        >
          {intl.formatMessage({
            id: 'action__copy',
          })}
        </Button>
      </Box>
    </Box>
  );
};
