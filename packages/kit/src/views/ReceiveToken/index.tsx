import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Empty,
  Image,
  Modal,
  QRCode,
  Text,
  ToastManager,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import BlurQRCode from '@onekeyhq/kit/assets/blur-qrcode.png';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';
import { useEnsureConnected } from '@onekeyhq/kit/src/hooks/useEnsureConnected';
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

  const { address, name } = route.params ?? {};

  const isVerticalLayout = useIsVerticalLayout();
  const { account, network, walletId, accountId, networkId } =
    useActiveWalletAccount();

  const shownAddress = address ?? account?.address ?? '';
  const shownName = name ?? account?.name ?? '';

  const { engine } = backgroundApiProxy;

  const [isHwWallet, setIsHwWallet] = useState(false);
  const [onHardwareConfirmed, setOnHardwareConfirmed] = useState(false);
  const [isLoadingForHardware, setIsLoadingForHardware] = useState(false);

  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      setIsHwWallet(!!device);
    });
  }, [engine, walletId]);

  const getAddress = useCallback(async () => {
    const hwAddress = await engine.getHWAddress(accountId, networkId, walletId);
    return hwAddress;
  }, [engine, accountId, networkId, walletId]);

  const { ensureConnected, abortConnect, confirmConnected } =
    useEnsureConnected();

  useEffect(() => {
    if (confirmConnected) {
      setIsLoadingForHardware(true);
      getAddress()
        .then((res) => setOnHardwareConfirmed(res === shownAddress))
        .catch((e: any) => {
          const { className, key, message } = e;
          if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
            ToastManager.show(
              {
                title: intl.formatMessage({ id: key }),
              },
              { type: 'error' },
            );
          } else {
            ToastManager.show(
              {
                title: message,
              },
              { type: 'default' },
            );
          }
        })
        .finally(() => setIsLoadingForHardware(false));
    }
  }, [confirmConnected, getAddress, intl, shownAddress]);

  useEffect(() => () => abortConnect(), [abortConnect]);

  const confirmOnDevice = useCallback(async () => {
    setIsLoadingForHardware(true);
    try {
      await ensureConnected(walletId);
    } finally {
      setIsLoadingForHardware(false);
    }
  }, [ensureConnected, walletId]);

  const copyAddressToClipboard = useCallback(() => {
    copyToClipboard(shownAddress);
    toast.show({ title: intl.formatMessage({ id: 'msg__address_copied' }) });
  }, [toast, shownAddress, intl]);

  const renderHiddenAddress = () => (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box
        borderRadius="24px"
        alignItems="center"
        justifyContent="center"
        w={{ base: 296, md: 208 }}
        h={{ base: 296, md: 208 }}
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
        <Center position="absolute" top={0} left={0} right={0} bottom={0} p={4}>
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
        maxW="256px"
        mx="auto"
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
          {shortenAddress(shownAddress)}
        </Text>
        <Button
          height={isVerticalLayout ? '50px' : '38px'}
          mt={isVerticalLayout ? '32px' : '24px'}
          type="primary"
          size={isVerticalLayout ? 'xl' : 'base'}
          isLoading={isLoadingForHardware}
          onPress={() => confirmOnDevice()}
        >
          {intl.formatMessage({
            id: 'action__check_address',
          })}
        </Button>
      </Box>
    </Box>
  );

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
          paddingTop: 24,
          paddingBottom: 24,
        },
        children: shownAddress ? (
          <>
            {isHwWallet && !onHardwareConfirmed ? (
              renderHiddenAddress()
            ) : (
              <>
                <Box
                  p={3}
                  mb={4}
                  rounded="xl"
                  bgColor="surface-default"
                  w={{ base: 296, md: 'auto' }}
                  mx="auto"
                >
                  <Text
                    typography="Body2"
                    color="text-subdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({ id: 'content__receive_description' })}
                  </Text>
                </Box>
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
                        size={
                          isVerticalLayout && platformEnv.isNative ? 264 : 186
                        }
                        logoSize={
                          isVerticalLayout && platformEnv.isNative ? 57 : 40
                        }
                        logoMargin={
                          isVerticalLayout && platformEnv.isNative ? 4 : 2
                        }
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
                      height={isVerticalLayout ? '48px' : '36px'}
                      mt={isVerticalLayout ? '32px' : '24px'}
                      type="plain"
                      size={isVerticalLayout ? 'xl' : 'base'}
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
              </>
            )}
          </>
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
