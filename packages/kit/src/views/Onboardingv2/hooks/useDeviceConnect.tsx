import { useCallback, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { get } from 'lodash';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import { Button, Dialog, Stack, Toast, XStack } from '@onekeyhq/components';
import type { IDBCreateHwWalletParamsBase } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  OneKeyHardwareError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useHelpLink } from '../../../hooks/useHelpLink';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareVerifyDialog } from '../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { useSelectAddWalletTypeDialog } from '../../Onboarding/pages/ConnectHardwareWallet/SelectAddWalletTypeDialog';
import {
  getForceTransportType,
  getHardwareCommunicationTypeString,
  trackHardwareWalletConnection,
} from '../utils';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';

export function useDeviceConnect() {
  const intl = useIntl();
  const actions = useAccountSelectorActions();

  const navigation = useAppNavigation();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { showSelectAddWalletTypeDialog } = useSelectAddWalletTypeDialog();
  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  const ensureStopScan = useCallback(async () => {
    // Force stop scanning and wait for any ongoing search to complete
    console.log(
      'ensureStopScan: Stopping device scan and waiting for completion',
    );

    try {
      // Use the new stopScanAndWait method that properly waits for ongoing searches
      await deviceScanner.stopScanAndWait();
      console.log(
        'ensureStopScan: Device scan stopped and all ongoing searches completed',
      );
    } catch (error) {
      console.error('ensureStopScan: Error while stopping scan:', error);
      // Fallback: just stop scan without waiting
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  const connectDevice = useCallback(
    async (device: SearchDevice) => {
      await ensureStopScan();
      try {
        return await backgroundApiProxy.serviceHardware.connect({
          device,
        });
      } catch (error: any) {
        if (error instanceof OneKeyHardwareError) {
          const { code, message } = error;
          if (
            code === HardwareErrorCode.CallMethodNeedUpgradeFirmware ||
            code === HardwareErrorCode.BlePermissionError ||
            code === HardwareErrorCode.BleLocationError
          ) {
            return;
          }
          Toast.error({
            title: message || 'DeviceConnectError',
          });
        } else {
          console.error('connectDevice error:', get(error, 'message', ''));
        }
      }
    },
    [ensureStopScan],
  );

  const emitFirmwareFailedVerifyResult = useCallback(
    ({
      device,
      errorMessage,
    }: {
      device: SearchDevice;
      errorMessage: string;
    }) => {
      appEventBus.emit(EAppEventBusNames.EmitFirmwareVerifyResult, {
        verified: false,
        device,
        payload: {
          deviceType: device.deviceType,
          data: '',
          cert: '',
          signature: '',
        },
        result: {
          code: -1,
          message: errorMessage,
        },
      });
    },
    [],
  );

  const fwUpdateActions = useFirmwareUpdateActions();
  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();

  const handleRestoreWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'restore',
        deviceType,
      });
    },
    [navigation],
  );

  const handleSetupNewWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'create',
        deviceType,
      });
    },
    [navigation],
  );

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleNotActivatedDevicePress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      const dialog = Dialog.show({
        icon: 'WalletCryptoOutline',
        title: intl.formatMessage({
          id: ETranslations.onboarding_activate_device,
        }),
        description: intl.formatMessage({
          id: ETranslations.onboarding_activate_device_help_text,
        }),
        dismissOnOverlayPress: false,
        renderContent: (
          <Stack>
            <ListItem
              alignItems="flex-start"
              icon="PlusCircleOutline"
              title={intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_set_up_new_wallet,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_set_up_new_wallet_help_text,
              })}
              drillIn
              onPress={async () => {
                await dialog.close();
                handleSetupNewWalletPress({ deviceType });
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
              title={intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_restore,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_restore_help_text,
              })}
              drillIn
              onPress={async () => {
                await dialog.close();
                const packageAlertDialog = Dialog.show({
                  tone: 'warning',
                  icon: 'PackageDeliveryOutline',
                  title: intl.formatMessage({
                    id: ETranslations.onboarding_activate_device_by_restore_warning,
                  }),
                  dismissOnOverlayPress: false,
                  description: intl.formatMessage({
                    id: ETranslations.onboarding_activate_device_by_restore_warning_help_text,
                  }),
                  showFooter: false,
                  renderContent: (
                    <XStack gap="$2.5">
                      <Button
                        flex={1}
                        size="large"
                        $gtMd={{ size: 'medium' } as any}
                        onPress={() => Linking.openURL(requestsUrl)}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_contact_us,
                        })}
                      </Button>
                      <Button
                        flex={1}
                        variant="primary"
                        size="large"
                        $gtMd={{ size: 'medium' } as any}
                        onPress={async () => {
                          await packageAlertDialog.close();
                          handleRestoreWalletPress({ deviceType });
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_continue,
                        })}
                      </Button>
                    </XStack>
                  ),
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
    },
    [handleRestoreWalletPress, handleSetupNewWalletPress, intl, requestsUrl],
  );

  // Shared device connection handler
  const verifyHardware = useCallback(
    async (device: SearchDevice, tabValue: EConnectDeviceChannel) => {
      await connectDevice(device);
      // Ensure all scanning and polling activities are stopped before connecting
      console.log('handleDeviceConnect: Starting device connection process');

      defaultLogger.account.wallet.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          hardwareWalletType: 'Standard',
          communication: getHardwareCommunicationTypeString(
            hardwareTransportType,
          ),
        },
        isSoftwareWalletOnlyUser,
      });

      if (device.deviceType === 'unknown') {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.hardware_connect_unknown_device_error,
          }),
        });
        return;
      }

      try {
        void backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
          connectId: device.connectId ?? '',
        });

        const handleBootloaderMode = (existsFirmware: boolean) => {
          fwUpdateActions.showBootloaderMode({
            connectId: device.connectId ?? undefined,
            existsFirmware,
          });
          console.log('Device is in bootloader mode', device);
          throw new OneKeyLocalError('Device is in bootloader mode');
        };

        if (
          await deviceUtils.isBootloaderModeFromSearchDevice({
            device: device as any,
          })
        ) {
          const existsFirmware =
            await deviceUtils.existsFirmwareFromSearchDevice({
              device: device as any,
            });
          handleBootloaderMode(existsFirmware);
          return;
        }

        // Set global transport type based on selected channel before connecting
        let forceTransportType: EHardwareTransportType | undefined;
        if (tabValue === EConnectDeviceChannel.bluetooth) {
          forceTransportType = EHardwareTransportType.DesktopWebBle;
        } else {
          forceTransportType = await getForceTransportType(tabValue);
        }
        if (forceTransportType) {
          await backgroundApiProxy.serviceHardware.setForceTransportType({
            forceTransportType,
          });
        }

        const features = await connectDevice(device);

        if (!features) {
          await trackHardwareWalletConnection({
            status: 'failure',
            isSoftwareWalletOnlyUser,
            deviceType: device.deviceType,
            features,
            hardwareTransportType: forceTransportType || hardwareTransportType,
          });
          throw new OneKeyHardwareError(
            'connect device failed, no features returned',
          );
        }

        if (await deviceUtils.isBootloaderModeByFeatures({ features })) {
          const existsFirmware = await deviceUtils.existsFirmwareByFeatures({
            features,
          });
          handleBootloaderMode(existsFirmware);
          return;
        }

        let deviceType = await deviceUtils.getDeviceTypeFromFeatures({
          features,
        });
        if (deviceType === 'unknown') {
          deviceType = device.deviceType || deviceType;
        }

        const deviceMode = await deviceUtils.getDeviceModeFromFeatures({
          features,
        });

        if (deviceMode === EOneKeyDeviceMode.backupMode) {
          await trackHardwareWalletConnection({
            status: 'failure',
            deviceType,
            isSoftwareWalletOnlyUser,
            features,
            hardwareTransportType: forceTransportType || hardwareTransportType,
          });
          Toast.error({
            title: 'Device is in backup mode',
          });
          return;
        }

        const shouldAuthenticateFirmware =
          await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
            device: {
              ...device,
              deviceId: device.deviceId || features.device_id,
            },
          });

        if (shouldAuthenticateFirmware) {
          void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
            connectId: device.connectId ?? '',
            hardClose: false,
            skipDelayClose: true,
            deviceResetToHome: false,
          });
          await showFirmwareVerifyDialog({
            device,
            features,
            onContinue: async ({ checked }: { checked: boolean }) => {
              if (deviceMode === EOneKeyDeviceMode.notInitialized) {
                handleNotActivatedDevicePress({ deviceType });
              }
            },
            onClose: () => {
              emitFirmwareFailedVerifyResult({
                device,
                errorMessage: intl.formatMessage({
                  id: ETranslations.hardware_user_cancel_error,
                }),
              });
            },
          });
          return;
        }
        void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: device.connectId ?? '',
          hardClose: false,
          skipDelayClose: true,
          deviceResetToHome: false,
        });

        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          handleNotActivatedDevicePress({ deviceType });
        }

        appEventBus.emit(EAppEventBusNames.EmitFirmwareVerifyResult, {
          verified: true,
          device,
          payload: {
            deviceType: device.deviceType,
            data: '',
            cert: '',
            signature: '',
          },
          result: undefined,
        });
      } catch (error) {
        // Clear force transport type on device connection error
        void backgroundApiProxy.serviceHardware.clearForceTransportType();
        void backgroundApiProxy.serviceHardwareUI.cleanHardwareUiState();
        console.error('handleDeviceConnect error:', error);
        emitFirmwareFailedVerifyResult({
          device,
          errorMessage:
            (error as { message: string }).message ?? 'Unknown error',
        });
        throw error;
      }
    },
    [
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
      intl,
      connectDevice,
      fwUpdateActions,
      showFirmwareVerifyDialog,
      handleNotActivatedDevicePress,
      emitFirmwareFailedVerifyResult,
    ],
  );

  const extractDeviceState = useCallback(
    (features: IOneKeyDeviceFeatures) => ({
      unlockedAttachPin: features.unlocked_attach_pin,
      unlocked: features.unlocked,
      passphraseEnabled: Boolean(features.passphrase_protection),
      deviceId: features.device_id,
    }),
    [],
  );

  const closeDialogAndReturn = useCallback(
    async (device: SearchDevice, options: { skipDelayClose?: boolean }) => {
      void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId ?? '',
        hardClose: true,
        skipDelayClose: options.skipDelayClose,
      });
    },
    [],
  );

  type IWalletCreationStrategy = {
    createHiddenWalletOnly: boolean;
    createStandardWalletOnly: boolean;
  };

  const determineWalletCreationStrategy = useCallback(
    async (
      deviceState: ReturnType<typeof extractDeviceState>,
      device: SearchDevice,
    ): Promise<IWalletCreationStrategy | null> => {
      if (!deviceState.unlocked) {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }

      if (deviceState.unlockedAttachPin) {
        return {
          createHiddenWalletOnly: deviceState.passphraseEnabled,
          createStandardWalletOnly: !deviceState.passphraseEnabled,
        };
      }

      const existsStandardWallet =
        await backgroundApiProxy.serviceAccount.existsHwStandardWallet({
          connectId: device.connectId ?? '',
          deviceId: deviceState.deviceId ?? '',
        });

      if (existsStandardWallet) {
        return {
          createHiddenWalletOnly: deviceState.passphraseEnabled,
          createStandardWalletOnly: !deviceState.passphraseEnabled,
        };
      }

      if (!deviceState.passphraseEnabled) {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }

      const walletType = await showSelectAddWalletTypeDialog();
      if (walletType === 'Standard') {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }
      if (walletType === 'Hidden') {
        return {
          createHiddenWalletOnly: true,
          createStandardWalletOnly: false,
        };
      }

      return null;
    },
    [showSelectAddWalletTypeDialog],
  );

  const createHwWallet = useCallback(
    async (
      device: SearchDevice,
      strategy: IWalletCreationStrategy,
      features: IOneKeyDeviceFeatures,
      isFirmwareVerified?: boolean,
      deviceState?: ReturnType<typeof extractDeviceState>,
    ) => {
      try {
        navigation.push(EOnboardingPages.FinalizeWalletSetup);

        const params: IDBCreateHwWalletParamsBase = {
          device,
          hideCheckingDeviceLoading: true,
          features,
          isFirmwareVerified,
          defaultIsTemp: true,
          isAttachPinMode: deviceState?.unlockedAttachPin,
        };
        if (strategy.createStandardWalletOnly) {
          await actions.current.createHWWalletWithoutHidden(params);
        } else {
          await actions.current.createHWWalletWithHidden(params);
        }

        await trackHardwareWalletConnection({
          status: 'success',
          deviceType: device.deviceType,
          features,
          hardwareTransportType,
          isSoftwareWalletOnlyUser,
        });

        await actions.current.updateHwWalletsDeprecatedStatus({
          connectId: device.connectId ?? '',
          deviceId: features.device_id || device.deviceId || '',
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
        navigation.pop();
        await trackHardwareWalletConnection({
          status: 'failure',
          deviceType: device.deviceType,
          features,
          hardwareTransportType,
          isSoftwareWalletOnlyUser,
        });
        throw error;
      } finally {
        await closeDialogAndReturn(device, { skipDelayClose: false });
      }
    },
    [
      actions,
      closeDialogAndReturn,
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
      navigation,
    ],
  );

  const onSelectAddWalletType = useCallback(
    async ({
      device,
      isFirmwareVerified,
    }: {
      device: SearchDevice;
      isFirmwareVerified?: boolean;
    }) => {
      await connectDevice(device);
      void backgroundApiProxy.serviceHardwareUI.showDeviceProcessLoadingDialog({
        connectId: device.connectId ?? '',
      });

      let features: IOneKeyDeviceFeatures | undefined;

      try {
        features =
          await backgroundApiProxy.serviceHardware.getFeaturesWithUnlock({
            connectId: device.connectId ?? '',
          });
      } catch (error) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        return;
      }

      const deviceState = extractDeviceState(features);
      const strategy = await determineWalletCreationStrategy(
        deviceState,
        device,
      );

      console.log('Current hardware wallet State', deviceState, strategy);
      if (!strategy) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        return;
      }

      await createHwWallet(
        device,
        strategy,
        features,
        isFirmwareVerified,
        deviceState,
      );
    },
    [
      connectDevice,
      extractDeviceState,
      determineWalletCreationStrategy,
      createHwWallet,
      closeDialogAndReturn,
    ],
  );
  return useMemo(
    () => ({
      connectDevice,
      ensureStopScan,
      onDeviceConnect: verifyHardware,
      verifyHardware,
      onSelectAddWalletType,
      createHWWallet: onSelectAddWalletType,
    }),
    [connectDevice, ensureStopScan, verifyHardware, onSelectAddWalletType],
  );
}
