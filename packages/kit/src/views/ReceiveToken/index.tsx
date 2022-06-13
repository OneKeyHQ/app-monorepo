import React, { useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  Modal,
  QRCode,
  Text,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';

import { ReceiveTokenRoutes, ReceiveTokenRoutesParams } from './types';

type NavigationProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenRoutes.ReceiveToken
>;

const ReceiveToken = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<NavigationProps>();

  const { address, name } = route.params ?? {};

  const isVerticalLayout = useIsVerticalLayout();
  const { account } = useActiveWalletAccount();

  const shownAddress = address ?? account?.address ?? '';
  const shownName = name ?? account?.name ?? '';

  const copyAddressToClipboard = useCallback(() => {
    copyToClipboard(shownAddress);
    toast.show({ title: intl.formatMessage({ id: 'msg__address_copied' }) });
  }, [toast, shownAddress, intl]);

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
        children: shownAddress ? (
          <Box flex={1} justifyContent="center" flexDirection="column">
            <Box alignItems="center" flexDirection="column">
              <Box
                borderRadius="24px"
                bgColor="#FFFFFF"
                p={isVerticalLayout ? '16px' : '11px'}
                shadow="depth.4"
              >
                <QRCode
                  value={shownAddress}
                  logo={qrcodeLogo}
                  size={isVerticalLayout ? 264 : 186}
                  logoSize={isVerticalLayout ? 57 : 40}
                  logoMargin={isVerticalLayout ? 4 : 2}
                  logoBackgroundColor="white"
                />
              </Box>
            </Box>
            <Box
              alignItems="center"
              mt={isVerticalLayout ? '32px' : '24px'}
              px={isVerticalLayout ? '67px' : '72px'}
            >
              <Text
                textAlign="center"
                typography={{ sm: 'DisplayMedium', md: 'Body1Strong' }}
                noOfLines={1}
              >
                {shownName}
              </Text>
              <Text
                mt="8px"
                color="text-subdued"
                textAlign="center"
                typography={{ sm: 'Body1', md: 'Body2' }}
                noOfLines={3}
              >
                {shownAddress}
              </Text>
              <Button
                width={isVerticalLayout ? '188px' : '154px'}
                height={isVerticalLayout ? '48px' : '36px'}
                mt={isVerticalLayout ? '32px' : '24px'}
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
            </Box>
          </Box>
        ) : (
          <Empty
            imageUrl={IconAccount}
            title={intl.formatMessage({
              id: 'empty__no_account_title',
            })}
          />
        ),
      }}
    />
  );
};
export default ReceiveToken;
