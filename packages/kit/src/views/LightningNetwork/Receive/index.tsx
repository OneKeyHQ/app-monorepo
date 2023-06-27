import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  Image,
  Modal,
  QRCode,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAccount, useNetwork } from '../../../hooks';

import type {
  ReceiveTokenModalRoutes,
  ReceiveTokenRoutesParams,
} from '../../ReceiveToken/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenModalRoutes.ReceiveInvoice
>;

const ReceiveInvoice = () => {
  const intl = useIntl();

  const route = useRoute<NavigationProps>();

  const { accountId, networkId, paymentRequest } = route.params ?? {};

  const isVerticalLayout = useIsVerticalLayout();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    accountId: accountId ?? null,
    networkId: networkId ?? '',
  });

  const copyInvoiceToClipboard = useCallback(() => {
    copyToClipboard(paymentRequest);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__copied' }),
    });
  }, [paymentRequest, intl]);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__receive' })}
      headerDescription={
        <Box flexDirection="row" alignItems="center" mt={0.5}>
          <Image
            alt="logoURI"
            source={{ uri: network?.logoURI }}
            size={4}
            borderRadius="full"
            mr={2}
          />
          <Text textAlign="center" typography="Caption" color="text-subdued">
            {network?.name}
          </Text>
        </Box>
      }
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          justifyContent: 'center',
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: paymentRequest ? (
          <Box mt={10} flex={1} flexDirection="column">
            <Box alignItems="center" flexDirection="column">
              <Box
                borderRadius="24px"
                bgColor="#FFFFFF"
                p={isVerticalLayout ? '16px' : '11px'}
                shadow="depth.4"
              >
                <QRCode
                  value={paymentRequest}
                  logo={qrcodeLogo}
                  size={isVerticalLayout && platformEnv.isNative ? 264 : 186}
                  logoSize={isVerticalLayout && platformEnv.isNative ? 57 : 40}
                  logoMargin={isVerticalLayout && platformEnv.isNative ? 4 : 2}
                  logoBackgroundColor="white"
                />
              </Box>
            </Box>
            <Box
              alignItems="center"
              mt={isVerticalLayout ? '32px' : '24px'}
              maxW="256px"
              mx="auto"
            >
              <Text
                textAlign="center"
                typography={{ sm: 'DisplayMedium', md: 'Body1Strong' }}
                noOfLines={1}
              >
                {account?.name}
              </Text>
              <Button
                mt="24px"
                size={isVerticalLayout ? 'lg' : 'base'}
                leftIconName="Square2StackMini"
                onPress={() => {
                  copyInvoiceToClipboard();
                }}
              >
                {intl.formatMessage({
                  id: 'action__copy',
                })}
              </Button>
            </Box>
          </Box>
        ) : (
          <Empty
            emoji="💳"
            title={intl.formatMessage({
              id: 'empty__no_account_title',
            })}
          />
        ),
      }}
    />
  );
};
export default ReceiveInvoice;
