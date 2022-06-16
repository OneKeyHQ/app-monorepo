import React, { useCallback, useEffect, useState } from 'react';

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
import { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import {
  ManagerAccountModalRoutes,
  ManagerAccountRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

type NavigationProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal
>;

const ExportPrivateViewModal = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<NavigationProps>();
  const { engine } = backgroundApiProxy;
  const isSmallScreen = useIsVerticalLayout();

  const { accountId, networkId, password } = route.params;

  const [privateKey, setPrivateKey] = useState<string>();
  const [account, setAccount] = useState<AccountEngineType>();

  useEffect(() => {
    if (!accountId || !networkId) return;

    engine.getAccount(accountId, networkId).then(($account) => {
      setAccount($account);
    });

    engine.getAccountPrivateKey(accountId, password).then(($privateKey) => {
      setPrivateKey($privateKey);
    });
  }, [accountId, engine, networkId, password]);

  const copyDataToClipboard = useCallback(() => {
    copyToClipboard(privateKey ?? '');
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [toast, privateKey, intl]);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__export_private_key' })}
      headerDescription={account?.name}
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
                {!!privateKey && (
                  <QRCode
                    value={privateKey}
                    logo={qrcodeLogo}
                    size={isSmallScreen ? 264 : 186}
                    logoSize={isSmallScreen ? 57 : 40}
                    logoMargin={isSmallScreen ? 4 : 2}
                    logoBackgroundColor="white"
                  />
                )}
              </Box>
            </Box>
            <Box
              alignItems="center"
              mt={isSmallScreen ? '32px' : '24px'}
              px={isSmallScreen ? '67px' : '72px'}
            >
              <Text
                color="text-subdued"
                textAlign="center"
                typography={{ sm: 'Body1', md: 'Body2' }}
                noOfLines={3}
              >
                {privateKey}
              </Text>
              <Button
                width={isSmallScreen ? '188px' : '154px'}
                height={isSmallScreen ? '48px' : '36px'}
                mt={isSmallScreen ? '32px' : '24px'}
                type="plain"
                size={isSmallScreen ? 'xl' : 'base'}
                leftIconName="DuplicateSolid"
                onPress={copyDataToClipboard}
              >
                {intl.formatMessage({
                  id: 'action__copy_address',
                })}
              </Button>
            </Box>
          </Box>
        ),
      }}
    />
  );
};

export default ExportPrivateViewModal;
