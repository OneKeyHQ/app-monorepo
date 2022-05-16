import React, { useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Modal,
  QRCode,
  Text,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReceiveTokenRoutes, ReceiveTokenRoutesParams } from './types';

type NavigationProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenRoutes.ReceiveToken
>;

const ReceiveToken = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<NavigationProps>();

  const { address, name } = route.params;
  const isSmallScreen = useIsVerticalLayout();
  const { network, account } = useActiveWalletAccount();
  const openBlockBrowser = useOpenBlockBrowser(network);

  const copyAddressToClipboard = useCallback(() => {
    copyToClipboard(address);
    toast.show({ title: intl.formatMessage({ id: 'msg__address_copied' }) });
  }, [toast, address, intl]);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__receive' })}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        },
        children: (
          <Box flex={1} justifyContent="center" flexDirection="column">
            <Box alignItems="center" flexDirection="column">
              <Box
                borderRadius="24px"
                bgColor="#FFFFFF"
                p={isSmallScreen ? '16px' : '11px'}
                shadow="depth.4"
              >
                <QRCode
                  value={address}
                  logo={qrcodeLogo}
                  size={isSmallScreen ? 264 : 186}
                  logoSize={isSmallScreen ? 57 : 40}
                  logoMargin={isSmallScreen ? 4 : 2}
                  logoBackgroundColor="white"
                />
              </Box>
            </Box>
            <Box
              alignItems="center"
              mt={isSmallScreen ? '32px' : '24px'}
              px={isSmallScreen ? '67px' : '72px'}
            >
              <Text
                textAlign="center"
                typography={{ sm: 'DisplayMedium', md: 'Body1Strong' }}
                noOfLines={1}
              >
                {name}
              </Text>
              <Text
                mt="8px"
                color="text-subdued"
                textAlign="center"
                typography={{ sm: 'Body1', md: 'Body2' }}
                noOfLines={3}
              >
                {address}
              </Text>
              <Button
                width={isSmallScreen ? '188px' : '154px'}
                height={isSmallScreen ? '48px' : '36px'}
                mt={isSmallScreen ? '32px' : '24px'}
                type="plain"
                size="xl"
                leftIconName="DuplicateSolid"
                onPress={() => {
                  setHaptics();
                  copyAddressToClipboard();
                }}
              >
                {intl.formatMessage({
                  id: 'action__copy_address',
                })}
              </Button>
              {platformEnv.isDev && (
                <Button
                  size="xs"
                  onPress={() =>
                    openBlockBrowser.openAddressDetails(account?.address)
                  }
                >
                  BlockBrowser
                </Button>
              )}
            </Box>
          </Box>
        ),
      }}
    />
  );
};
export default ReceiveToken;
