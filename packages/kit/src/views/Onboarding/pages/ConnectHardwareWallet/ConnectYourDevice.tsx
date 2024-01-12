import { useCallback, useEffect, useState } from 'react';

import { Linking, StyleSheet } from 'react-native';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Dialog,
  HeightTransition,
  Icon,
  ListItem,
  LottieView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import ConnectByBluetoothAnim from '@onekeyhq/kit/assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '@onekeyhq/kit/assets/animations/connect_by_usb.json';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { EOnboardingPages } from '../../router/type';

const headerRight = (onPress: () => void) => (
  <HeaderIconButton icon="QuestionmarkOutline" onPress={onPress} />
);

const FirmwareAuthenticationDialogContent = ({
  onContinue,
}: {
  onContinue: () => void;
}) => {
  const [result, setResult] = useState('unknown'); // unknown, official, unofficial, error
  const [confirmOnDevice, setIsConfirmOnDevice] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setIsConfirmOnDevice(true);
      setTimeout(() => {
        setResult('official');
      }, 3000);
    }, 3000);
  });

  return (
    <Stack>
      <HeightTransition initialHeight={106}>
        <Stack
          borderRadius="$3"
          p="$5"
          bg="$bgSubdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$transparent"
          {...(result === 'official' && {
            bg: '$bgSuccessSubdued',
            borderColor: '$borderSuccessSubdued',
          })}
          {...(result === 'unofficial' && {
            bg: '$bgCriticalSubdued',
            borderColor: '$borderCriticalSubdued',
          })}
          {...(result === 'error' && {
            bg: '$bgCautionSubdued',
            borderColor: '$borderCautionSubdued',
          })}
          style={{ borderCurve: 'continuous' }}
        >
          {!confirmOnDevice ? (
            <XStack alignItems="center">
              <Stack
                w="$16"
                h="$16"
                bg="$bgStrong"
                borderRadius="$2"
                style={{ borderCurve: 'continuous' }}
                justifyContent="center"
                alignItems="center"
              >
                <LottieView
                  width="$16"
                  height="$16"
                  source={require('@onekeyhq/kit/assets/animations/confirm-on-classic.json')}
                />
              </Stack>
              <SizableText textAlign="center" pl="$4">
                Confirm on device
              </SizableText>
            </XStack>
          ) : (
            <Stack>
              <Stack justifyContent="center" alignItems="center">
                {result === 'unknown' ? (
                  <Spinner size="large" />
                ) : (
                  <Icon
                    name="BadgeVerifiedSolid"
                    size="$9"
                    color="$iconSuccess"
                    {...(result === 'unofficial' && {
                      name: 'ErrorSolid',
                      color: '$iconCritical',
                    })}
                    {...(result === 'error' && {
                      name: 'ErrorSolid',
                      color: '$iconCaution',
                    })}
                  />
                )}
              </Stack>

              <SizableText
                textAlign="center"
                mt="$5"
                {...(result === 'official' && {
                  color: '$textSuccess',
                })}
                {...(result === 'unofficial' && {
                  color: '$textCritical',
                })}
                {...(result === 'error' && {
                  color: '$textCaution',
                })}
              >
                {result === 'unknown' && 'Verifying official firmware'}
                {result === 'official' &&
                  'Your device is running official firmware'}
                {result === 'unofficial' && 'Unofficial firmware detected!'}
                {result === 'error' &&
                  'Unable to verify firmware: internet connection required'}
              </SizableText>
            </Stack>
          )}
        </Stack>
        {result !== 'unknown' && (
          <Stack pt="$5">
            <Button
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
              variant="primary"
              {...(result === 'official' && {
                onPress: onContinue,
              })}
              {...(result === 'unofficial' && {
                onPress: async () => {
                  await Linking.openURL(
                    'https://help.onekey.so/hc/requests/new',
                  );
                },
              })}
              {...(result === 'error' && {
                onPress: async () => {
                  setResult('unknown');
                },
              })}
            >
              {result === 'official' && 'Continue'}
              {result === 'unofficial' && 'Contact OneKey Support'}
              {result === 'error' && 'Retry'}
            </Button>
          </Stack>
        )}
        {result === 'error' && (
          <Stack pt="$3">
            <Button variant="tertiary" m="$0" onPress={onContinue}>
              Continue Anyway
            </Button>
          </Stack>
        )}
      </HeightTransition>
    </Stack>
  );
};

export function ConnectYourDevice() {
  const navigation = useAppNavigation();

  const handleHeaderRightPress = () => {
    navigation.push(EOnboardingPages.OneKeyHardwareWallet);
  };

  const handleWalletItemPress = () => {
    navigation.push(EOnboardingPages.FinalizeWalletSetup);
  };

  const handleSetupNewWalletPress = useCallback(() => {
    navigation.push(EOnboardingPages.ActivateDevice);
  }, [navigation]);

  const handleNotActivatedDevicePress = useCallback(() => {
    const dialog = Dialog.show({
      icon: 'WalletCryptoOutline',
      title: 'Activate Your Device',
      description: 'Set up your hardware wallet to get started.',
      renderContent: (
        <Stack>
          <ListItem
            alignItems="flex-start"
            icon="PlusCircleOutline"
            title="Set Up New Wallet"
            subtitle="Configure your device to create a new wallet."
            drillIn
            onPress={async () => {
              await dialog.close();
              handleSetupNewWalletPress();
            }}
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            m="$0"
            py="$2.5"
            bg="$bgSubdued"
          />
          <ListItem
            alignItems="flex-start"
            icon="ArrowBottomCircleOutline"
            title="Restore Wallet"
            subtitle="Restore your wallet using an existing recovery phrase."
            drillIn
            onPress={async () => {
              await dialog.close();
              const packageAlertDialog = Dialog.show({
                icon: 'PackageDeliveryOutline',
                title: 'Package Security Check',
                description:
                  'Your package should not contain any pre-set PINs or Recovery Phrases. If such items are found, stop using the device and immediately reach out to OneKey Support for assistance.',
                onCancel: () =>
                  Linking.openURL('https://help.onekey.so/hc/requests/new'),
                onCancelText: 'Get Help',
                onConfirm: async () => {
                  await packageAlertDialog.close();
                  handleSetupNewWalletPress();
                },
                onConfirmText: 'Understood',
              });
            }}
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            m="$0"
            mt="$2.5"
            py="$2.5"
            bg="$bgSubdued"
          />
        </Stack>
      ),
      showFooter: false,
    });
  }, [handleSetupNewWalletPress]);

  const handleFirmwareAuthentication = () => {
    const firmwareAuthenticationDialog = Dialog.show({
      title: 'Firmware Authentication',
      renderContent: (
        <FirmwareAuthenticationDialogContent
          onContinue={async () => {
            await firmwareAuthenticationDialog.close();
            handleNotActivatedDevicePress();
          }}
        />
      ),
      showFooter: false,
    });
  };

  const handleCheckingDevice = () => {
    const checkingDeviceDialog = Dialog.show({
      title: 'Checking Device',
      renderContent: (
        <Stack
          borderRadius="$3"
          p="$5"
          bg="$bgSubdued"
          style={{ borderCurve: 'continuous' }}
        >
          <Spinner size="large" />
        </Stack>
      ),
      showFooter: false,
    });

    setTimeout(async () => {
      await checkingDeviceDialog.close();
      handleFirmwareAuthentication();
    }, 1000);
  };

  const DevicesData = [
    {
      title: 'OneKey Classic',
      src: HwWalletAvatarImages.classic,
      onPress: handleCheckingDevice,
    },
    {
      title: 'OneKey Mini',
      src: HwWalletAvatarImages.mini,
      onPress: handleWalletItemPress,
    },
    {
      title: 'OneKey Touch',
      src: HwWalletAvatarImages.touch,
    },
    {
      title: 'OneKey Pro',
      src: HwWalletAvatarImages.pro,
    },
  ];

  return (
    <Page>
      <Page.Header
        title={
          platformEnv.isNative ? 'Looking for Devices' : 'Connect Your Device'
        }
        headerRight={() => headerRight(handleHeaderRightPress)}
      />
      <Page.Body>
        {/* animation */}
        <Stack p="$5" pt="$0" mb="$4" alignItems="center" bg="$bgSubdued">
          <LottieView
            width="100%"
            height="$56"
            source={
              platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
            }
          />
          <SizableText textAlign="center" color="$textSubdued" mt="$1.5">
            {platformEnv.isNative
              ? 'Please make sure your Bluetooth is enabled'
              : 'Connect your device via USB'}
          </SizableText>
        </Stack>

        {/* devices */}
        <HeightTransition>
          <Stack>
            {DevicesData.map((item, index) => (
              <ListItem
                avatarProps={{
                  src: item.src,
                }}
                key={index}
                title={item.title}
                drillIn
                onPress={item.onPress}
                focusable={false}
              />
            ))}
          </Stack>
        </HeightTransition>

        {/* buy link */}
        <XStack
          px="$5"
          py="$0.5"
          mt="auto"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            Don't have OneKey yet?
          </SizableText>
          <Anchor
            display="flex"
            color="$textInteractive"
            hoverStyle={{
              color: '$textInteractiveHover',
            }}
            href="https://shop.onekey.so/"
            target="_blank"
            size="$bodyMdMedium"
            p="$2"
          >
            Buy One
          </Anchor>
        </XStack>
      </Page.Body>
    </Page>
  );
}

export default ConnectYourDevice;
