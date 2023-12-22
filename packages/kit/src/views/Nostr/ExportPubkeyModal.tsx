import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Image,
  Modal,
  Spinner,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import BlurQRCode from '@onekeyhq/kit/assets/blur-qrcode.png';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { PrivateOrPublicKeyPreview } from '@onekeyhq/kit/src/views/ManagerAccount/ExportPrivate/previewView';
import { isHardwareWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { deviceUtils } from '../../utils/hardware';

import { useExistNostrAccount } from './hooks/useExistNostrAccount';

import type { NostrRoutesParams } from '../../routes';
import type { NostrModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = RouteProp<
  NostrRoutesParams,
  NostrModalRoutes.ExportPubkey
>;

const ExportPublicKeyView: FC<{
  walletId: string;
  networkId: string;
  accountId: string;
  password: string;
}> = ({ walletId, networkId, accountId, password }) => {
  const intl = useIntl();
  const [publicKey, setPublicKey] = useState<string>();
  const [hardwareConfirmed, setHardwareConfirmed] = useState(false);
  const [ignoreDeviceCheck, setIgnoreDeviceCheck] = useState(false);
  const [isLoadingForHardware, setIsLoadingForHardware] = useState(false);
  const navigation = useAppNavigation();
  const isVerticalLayout = useIsVerticalLayout();
  const isHwWallet = isHardwareWallet({ walletId });
  const isFetchingPubkeyRef = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        isFetchingPubkeyRef.current = true;
        setIsLoadingForHardware(true);
        const pubkey =
          await backgroundApiProxy.serviceNostr.getPublicKeyEncodedByNip19({
            walletId,
            networkId,
            accountId,
            password,
          });
        setPublicKey(pubkey);
      } catch (e) {
        deviceUtils.showErrorToast(e);
        setTimeout(() => {
          navigation.goBack?.();
        }, 200);
      } finally {
        isFetchingPubkeyRef.current = false;
        setIsLoadingForHardware(false);
      }
    })();
  }, [walletId, networkId, accountId, password, navigation]);

  const onCheckPubkey = useCallback(async () => {
    if (isFetchingPubkeyRef.current) {
      return;
    }
    setIsLoadingForHardware(true);
    try {
      const npub = await backgroundApiProxy.serviceNostr.validateNpubOnHardware(
        {
          walletId,
          networkId,
          accountId,
          password: '',
        },
      );
      const isSameNpub = publicKey === npub;
      if (!isSameNpub) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__address_is_inconsistent_please_check_manually',
            }),
          },
          { type: 'default' },
        );
      }
      setHardwareConfirmed(true);
    } catch (e) {
      deviceUtils.showErrorToast(e);
    } finally {
      setIsLoadingForHardware(false);
    }
  }, [walletId, networkId, accountId, publicKey, intl]);

  const renderHiddenAddress = useMemo(
    () => (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Box
          borderRadius="24px"
          alignItems="center"
          justifyContent="center"
          w={{ base: platformEnv.isExtension ? 240 : 296, md: 208 }}
          h={{ base: platformEnv.isExtension ? 240 : 296, md: 208 }}
          bgColor="white"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
          overflow="hidden"
        >
          <Image
            source={BlurQRCode}
            w={{ base: 296, md: 208 }}
            h={{ base: 296, md: 208 }}
          />
          <Center
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            p={4}
          >
            <Text
              typography={{ sm: 'Body1', md: 'Body2' }}
              color="#000"
              opacity={80}
              textAlign="center"
            >
              {intl.formatMessage({
                id: 'content__check_the_address_on_device',
              })}
            </Text>
          </Center>
        </Box>
        <Box
          alignItems="center"
          mt={isVerticalLayout ? '32px' : '24px'}
          mx="auto"
          maxWidth="full"
        >
          <Text
            mt="8px"
            maxW="256px"
            color="text-subdued"
            textAlign="center"
            typography={{ sm: 'Body1', md: 'Body2' }}
            w="full"
            maxWidth="full"
          >
            {isLoadingForHardware ? publicKey : shortenAddress(publicKey ?? '')}
          </Text>
          <Button
            mt="24px"
            type="primary"
            size={isVerticalLayout ? 'lg' : 'base'}
            isLoading={isLoadingForHardware}
            onPress={() => onCheckPubkey()}
          >
            {intl.formatMessage({
              id: 'action__check_address',
            })}
          </Button>
          <Button
            mt={4}
            size={isVerticalLayout ? 'lg' : 'base'}
            onPress={() => setIgnoreDeviceCheck(true)}
          >
            {intl.formatMessage({
              id: 'action__dont_have_device',
            })}
          </Button>
        </Box>
      </Box>
    ),
    [intl, isVerticalLayout, publicKey, isLoadingForHardware, onCheckPubkey],
  );

  const shouldHiddenAddress =
    isHwWallet && !hardwareConfirmed && !ignoreDeviceCheck;

  if (shouldHiddenAddress) {
    return <>{renderHiddenAddress}</>;
  }

  return (
    <PrivateOrPublicKeyPreview
      privateOrPublicKey={publicKey}
      qrCodeContainerSize={{ base: 296, md: 208 }}
    />
  );
};

const ExportPubkeyModal = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const { walletId, networkId, accountId } = route.params;
  const { isFetchNostrAccount, existNostrAccount } = useExistNostrAccount({
    walletId,
    currentAccountId: accountId,
    currentNetworkId: networkId,
  });

  const content = useMemo(() => {
    if (existNostrAccount) {
      return (
        <ExportPublicKeyView
          walletId={walletId}
          networkId={networkId}
          accountId={accountId}
          password=""
        />
      );
    }
    return (
      <Protected walletId={walletId}>
        {(pwd) => (
          <ExportPublicKeyView
            walletId={walletId}
            networkId={networkId}
            accountId={accountId}
            password={pwd}
          />
        )}
      </Protected>
    );
  }, [existNostrAccount, walletId, networkId, accountId]);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'title__nostr_public_key' })}
      height="auto"
    >
      {isFetchNostrAccount ? <Spinner size="lg" /> : content}
    </Modal>
  );
};

export default ExportPubkeyModal;
