import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
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
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import BlurQRCode from '@onekeyhq/kit/assets/blur-qrcode.png';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IActiveWalletAccount } from '../../hooks';
import type {
  ReceiveTokenModalRoutes,
  ReceiveTokenRoutesParams,
} from './types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenModalRoutes.ReceiveToken
>;

const ReceiveToken = () => {
  const intl = useIntl();

  const route = useRoute<NavigationProps>();

  const { address, displayAddress, name } = route.params ?? {};
  const routePrams = route.params;

  const isVerticalLayout = useIsVerticalLayout();
  const activeInfo: IActiveWalletAccount = useActiveWalletAccount();

  const account = routePrams?.account ?? activeInfo?.account;
  const network = routePrams?.network ?? activeInfo?.network;
  const wallet = routePrams?.wallet ?? activeInfo?.wallet;
  const customPath = routePrams?.customPath;
  const template = routePrams?.template ?? account?.template;

  const accountId = account?.id || '';
  const networkId = network?.id || '';
  const walletId = wallet?.id || '';

  const shownAddress =
    displayAddress ??
    address ??
    account?.displayAddress ??
    account?.address ??
    '';
  const shownName = name ?? account?.name ?? '';

  const { engine } = backgroundApiProxy;

  const isHwWallet = wallet?.type === 'hw';
  const [onHardwareConfirmed, setOnHardwareConfirmed] = useState(false);
  const [ignoreDeviceCheck, setIgnoreDeviceCheck] = useState(false);
  const [isLoadingForHardware, setIsLoadingForHardware] = useState(false);

  // single address without account
  const isSingleAddress = useMemo(
    () => template && customPath,
    [template, customPath],
  );

  const getAddress = useCallback(async () => {
    const hwAddress = await engine.getHWAddress(accountId, networkId, walletId);
    return hwAddress;
  }, [engine, accountId, networkId, walletId]);

  const getAddressByPath = useCallback(async () => {
    if (!customPath || !template) return '';
    const accountIndex = customPath.split('/')[3].slice(0, -1);
    const res =
      await backgroundApiProxy.serviceDerivationPath.getHWAddressByTemplate({
        networkId,
        walletId,
        index: parseInt(accountIndex ?? '0', 10),
        template,
        fullPath: customPath,
      });
    return res.address;
  }, [customPath, template, networkId, walletId]);

  const confirmOnDevice = useCallback(async () => {
    setIsLoadingForHardware(true);
    try {
      let res: string;
      if (isSingleAddress) {
        res = await getAddressByPath();
      } else {
        res = await getAddress();
      }
      const isSameAddress = res === (address ?? account?.address);
      if (!isSameAddress) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__address_is_inconsistent_please_check_manually',
            }),
          },
          { type: 'default' },
        );
      }
      setOnHardwareConfirmed(isSameAddress);
      console.log(res);
    } catch (e: any) {
      deviceUtils.showErrorToast(e);
    } finally {
      setIsLoadingForHardware(false);
    }
  }, [getAddress, getAddressByPath, isSingleAddress, intl, address, account]);

  const copyAddressToClipboard = useCallback(() => {
    copyToClipboard(shownAddress);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__address_copied' }),
    });
  }, [shownAddress, intl]);

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
            textAlign="center"
            typography={{ sm: 'DisplayMedium', md: 'Body1Strong' }}
            noOfLines={1}
          >
            {shownName}
          </Text>
          <Text
            mt="8px"
            maxW="256px"
            color="text-subdued"
            textAlign="center"
            typography={{ sm: 'Body1', md: 'Body2' }}
            w="full"
            maxWidth="full"
          >
            {isLoadingForHardware ? shownAddress : shortenAddress(shownAddress)}
          </Text>
          <Button
            mt="24px"
            type="primary"
            size={isVerticalLayout ? 'lg' : 'base'}
            isLoading={isLoadingForHardware}
            onPress={() => confirmOnDevice()}
          >
            {intl.formatMessage({
              id: 'action__check_address',
            })}
          </Button>
          {isSingleAddress ? null : (
            <Button
              mt={4}
              size={isVerticalLayout ? 'lg' : 'base'}
              onPress={() => setIgnoreDeviceCheck(true)}
            >
              {intl.formatMessage({
                id: 'action__dont_have_device',
              })}
            </Button>
          )}
        </Box>
      </Box>
    ),
    [
      isLoadingForHardware,
      shownAddress,
      shownName,
      intl,
      isVerticalLayout,
      confirmOnDevice,
      isSingleAddress,
    ],
  );

  const shouldHiddenAddress =
    isHwWallet && !onHardwareConfirmed && !ignoreDeviceCheck;

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
        children: shownAddress ? (
          <>
            {shouldHiddenAddress ? (
              renderHiddenAddress
            ) : (
              <>
                <Box mb={4} w="auto" mx="auto">
                  <Text
                    typography={platformEnv.isExtension ? 'Caption' : 'Body2'}
                    color="text-subdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({ id: 'content__receive_description' })}
                  </Text>
                  {ignoreDeviceCheck && (
                    <Text
                      typography={platformEnv.isExtension ? 'Caption' : 'Body2'}
                      color="text-warning"
                      textAlign="center"
                    >
                      {intl.formatMessage({
                        id: 'content__address_not_confirmed_on_device',
                      })}
                    </Text>
                  )}
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
                      w="full"
                      maxWidth="full"
                    >
                      {shownAddress}
                    </Text>
                    <Button
                      mt="24px"
                      size={isVerticalLayout ? 'lg' : 'base'}
                      leftIconName="Square2StackMini"
                      onPress={() => {
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
export default ReceiveToken;
