import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Image,
  Modal,
  QRCode,
  Spinner,
  Text,
  ToastManager,
  ZStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import BlurQRCode from '@onekeyhq/kit/assets/blur-qrcode.png';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type {
  ManagerAccountModalRoutes,
  ManagerAccountRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { RouteProp } from '@react-navigation/core';

type ExportPrivateViewProps = {
  accountId: string;
  networkId: string;
  password: string;
  onAccountChange: (account: AccountEngineType) => void;
};

const ExportPrivateView: FC<ExportPrivateViewProps> = ({
  accountId,
  networkId,
  password,
  onAccountChange,
}) => {
  const intl = useIntl();

  const { engine } = backgroundApiProxy;
  const isSmallScreen = useIsVerticalLayout();
  const qrCodeContainerSize = { base: 296, md: 208 };

  const [privateKey, setPrivateKey] = useState<string>();

  useEffect(() => {
    if (!accountId || !networkId || !password) return;

    engine.getAccount(accountId, networkId).then(($account) => {
      onAccountChange($account);
    });

    engine.getAccountPrivateKey(accountId, password).then(($privateKey) => {
      setPrivateKey($privateKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, engine, networkId, password]);

  const copyDataToClipboard = useCallback(() => {
    copyToClipboard(privateKey ?? '');
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [privateKey, intl]);

  const renderLoading = () => (
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

  return (
    <Box py="24px" justifyContent="center" flexDirection="column">
      <Box
        minH={qrCodeContainerSize}
        alignItems="center"
        flexDirection="column"
      >
        {privateKey ? (
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
        ) : (
          renderLoading()
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
          noOfLines={5}
        >
          {privateKey}
        </Text>
        <Button
          width={isSmallScreen ? '188px' : '154px'}
          height={isSmallScreen ? '48px' : '36px'}
          mt={isSmallScreen ? '32px' : '24px'}
          type="plain"
          size={isSmallScreen ? 'xl' : 'base'}
          leftIconName="Square2StackMini"
          onPress={copyDataToClipboard}
        >
          {intl.formatMessage({
            id: 'action__copy',
          })}
        </Button>
      </Box>
    </Box>
  );
};

type NavigationProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal
>;

const ExportPrivateViewModal = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const { accountId, networkId } = route.params;
  const [account, setAccount] = useState<AccountEngineType>();

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__export_private_key' })}
      headerDescription={account?.name}
      height="auto"
    >
      <Protected
        walletId={null}
        skipSavePassword
        field={ValidationFields.Secret}
      >
        {(pwd) => (
          <ExportPrivateView
            accountId={accountId}
            networkId={networkId}
            password={pwd}
            onAccountChange={(acc) => setAccount(acc)}
          />
        )}
      </Protected>
    </Modal>
  );
};
export default ExportPrivateViewModal;
