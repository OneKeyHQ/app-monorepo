import { useCallback, useEffect, useMemo, useRef } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIsFocused } from '@react-navigation/core';
import { get, noop, throttle } from 'lodash';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import { Button, Dialog, Stack, Toast, XStack } from '@onekeyhq/components';
import type { IDBCreateHwWalletParamsBase } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EHardwareUiStateAction,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type {
  IFirmwareVerifyResult,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

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

import { usePrepareUSBConnectForFirmwareUpdate } from './usePrepareUSBConnectForFirmwareUpdate';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';

export function useDeviceConnect({
  setCurrentDevice,
}: {
  setCurrentDevice?: React.Dispatch<
    React.SetStateAction<SearchDevice | undefined>
  >;
} = {}) {
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
  const activeDeviceRef = useRef<SearchDevice | null>(null);
  const activeFeaturesRef = useRef<IOneKeyDeviceFeatures | null>(null);
  const wasInBootloaderModeRef = useRef<boolean>(false);

  const isSameHardware = useCallback(
    (target: SearchDevice, current: SearchDevice | null) => {
      if (!current) {
        return false;
      }
      if (target.connectId && current.connectId) {
        return target.connectId === current.connectId;
      }
      if (target.deviceId && current.deviceId) {
        return target.deviceId === current.deviceId;
      }
      const targetUuid = (target as { uuid?: string }).uuid;
      const currentUuid = (current as { uuid?: string }).uuid;
      if (targetUuid && currentUuid) {
        return targetUuid === currentUuid;
      }
      return false;
    },
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
      throw new OneKeyLocalError('Error while stopping scan');
    }
  }, [deviceScanner]);

  const connectDevice = useCallback(
    async (
      device: SearchDevice,
      hardwareCallContext?: EHardwareCallContext,
    ) => {
      await ensureStopScan();
      try {
        const features = await backgroundApiProxy.serviceHardware.connect({
          device,
          hardwareCallContext,
        });
        activeDeviceRef.current = { ...device };
        activeFeaturesRef.current = features ?? null;
        return features;
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
        }
        defaultLogger.hardware.sdkLog.connectError({
          connectId: device.connectId ?? '',
          deviceId: device.deviceId ?? '',
          deviceType: device.deviceType ?? '',
          uuid: device.uuid ?? '',
          error: get(error, 'message', ''),
        });
        throw error;
      }
    },
    [ensureStopScan],
  );

  const ensureActiveConnection = useCallback(
    async (device: SearchDevice, options?: { forceReconnect?: boolean }) => {
      // If device was in bootloader mode, force reconnect to get fresh features
      const shouldForceReconnect =
        options?.forceReconnect || wasInBootloaderModeRef.current;

      if (
        !shouldForceReconnect &&
        isSameHardware(device, activeDeviceRef.current) &&
        activeFeaturesRef.current
      ) {
        return activeFeaturesRef.current;
      }

      // Clear bootloader mode flag when reconnecting
      wasInBootloaderModeRef.current = false;
      let hardwareCallContext: EHardwareCallContext | undefined;
      let isBootMode = false;
      if (
        await deviceUtils.isBootloaderModeFromSearchDevice({
          device: device as any,
        })
      ) {
        hardwareCallContext = EHardwareCallContext.UPDATE_FIRMWARE;
        isBootMode = true;
      }

      const features = await connectDevice(device, hardwareCallContext);
      // If device was in bootloader mode and connectId is empty, search for the updated device
      if (device.connectId === '' && isBootMode && !features?.bootloader_mode) {
        const searchedDevices =
          await backgroundApiProxy.serviceHardware.searchDevices();
        if (searchedDevices.success && searchedDevices.payload.length === 1) {
          const updatedDevice = searchedDevices.payload[0];
          // Update activeDeviceRef with the fresh device info
          activeDeviceRef.current = { ...updatedDevice };
          // Sync to parent component if callback provided
          setCurrentDevice?.(updatedDevice);
        }
      }
      return features;
    },
    [connectDevice, isSameHardware, setCurrentDevice],
  );

  const getActiveDevice = useCallback(() => {
    return activeDeviceRef.current ?? undefined;
  }, []);

  const getActiveDeviceFeatures = useCallback(() => {
    return activeFeaturesRef.current ?? undefined;
  }, []);

  const fwUpdateActions = useFirmwareUpdateActions();
  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();
  const { prepareUSBConnect } = usePrepareUSBConnectForFirmwareUpdate();

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
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.hardware_connect_unknown_device_error,
          }),
        );
      }

      try {
        void backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
          connectId: device.connectId ?? '',
        });

        const handleBootloaderMode = async (existsFirmware: boolean) => {
          // Set bootloader mode flag so retry will force reconnect
          wasInBootloaderModeRef.current = true;

          // Save current features before clearing (needed for USB connectId building)
          const savedFeatures = activeFeaturesRef.current;
          // Clear cached features to ensure fresh data on retry
          activeFeaturesRef.current = null;

          // Prepare USB connection callback (called when user clicks "Update now")
          const prepareUSBForUpdate = async () => {
            // Use saved features from bootloader detection (avoids extra hardware request)
            let features = savedFeatures ?? undefined;
            if (!features) {
              // Fallback: fetch fresh from device if no saved features
              features = await ensureActiveConnection(device);
            }

            const usbPrepareResult = await prepareUSBConnect({
              device,
              features,
            });

            // If USB preparation failed (e.g., USB not available), return undefined
            // This will prevent openChangeLogModal from being called
            if (!usbPrepareResult) {
              return undefined;
            }

            // Return USB connectId if preparation succeeded, otherwise fallback
            return usbPrepareResult.connectId ?? device.connectId ?? undefined;
          };

          fwUpdateActions.showBootloaderMode({
            connectId: device.connectId ?? undefined,
            existsFirmware,
            onBeforeUpdate: prepareUSBForUpdate,
          });
          console.log('Device is in bootloader mode', device);
          throw new OneKeyLocalError('Device is in bootloader mode');
        };

        // Skip SearchDevice-based bootloader check if we're retrying after bootloader mode
        // because device.mode might still be 'bootloader' even after firmware update
        if (!wasInBootloaderModeRef.current) {
          if (
            await deviceUtils.isBootloaderModeFromSearchDevice({
              device: device as any,
            })
          ) {
            const existsFirmware =
              await deviceUtils.existsFirmwareFromSearchDevice({
                device: device as any,
              });
            await handleBootloaderMode(existsFirmware);
            return;
          }
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

        const features = await ensureActiveConnection(device);
        // Get the latest device reference after connection (it may have been updated)
        const latestDevice = getActiveDevice() ?? device;

        if (!features) {
          await trackHardwareWalletConnection({
            status: 'failure',
            isSoftwareWalletOnlyUser,
            deviceType: latestDevice.deviceType,
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
          await handleBootloaderMode(existsFirmware);
          return;
        }

        let deviceType = await deviceUtils.getDeviceTypeFromFeatures({
          features,
        });
        if (deviceType === 'unknown') {
          deviceType = latestDevice.deviceType || deviceType;
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
          throw new OneKeyLocalError('Device is in backup mode');
        }

        const shouldAuthenticateFirmware =
          await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
            device: {
              ...latestDevice,
              deviceId: latestDevice.deviceId || features.device_id,
            },
          });

        if (shouldAuthenticateFirmware) {
          void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
            connectId: latestDevice.connectId ?? '',
            hardClose: false,
            skipDelayClose: true,
            deviceResetToHome: false,
          });
          let isVerified: boolean | undefined;
          const result = await new Promise<IFirmwareVerifyResult>(
            (resolve, reject) => {
              void showFirmwareVerifyDialog({
                device: latestDevice,
                features,
                onVerified: ({ checked }: { checked: boolean }) => {
                  isVerified = checked;
                  setTimeout(() => {
                    resolve({
                      verified: checked,
                      skipVerification: checked === false,
                      device: latestDevice,
                      payload: {
                        deviceType: latestDevice.deviceType,
                        data: '',
                        cert: '',
                        signature: '',
                      },
                      result: {
                        message: '',
                      },
                    });
                  }, 150);
                },
                onDevSkipVerificationPress: () => {
                  isVerified = false;
                  setTimeout(() => {
                    resolve({
                      verified: false,
                      skipVerification: true,
                      device: latestDevice,
                      payload: {
                        deviceType: latestDevice.deviceType,
                        data: '',
                        cert: '',
                        signature: '',
                      },
                      result: {
                        message: '',
                      },
                    });
                  }, 150);
                },
                onContinue: () => {},
                onClose: () => {
                  if (isVerified === undefined) {
                    reject(
                      new OneKeyLocalError(
                        intl.formatMessage({
                          id: ETranslations.hardware_user_cancel_error,
                        }),
                      ),
                    );
                  }
                },
              });
            },
          );
          return result;
        }
        void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: latestDevice.connectId ?? '',
          hardClose: false,
          skipDelayClose: true,
          deviceResetToHome: false,
        });

        // if (deviceMode === EOneKeyDeviceMode.notInitialized) {
        //   handleNotActivatedDevicePress({ deviceType });
        // }

        return {
          verified: true,
          device: latestDevice,
          payload: {
            deviceType: latestDevice.deviceType,
            data: '',
            cert: '',
            signature: '',
          },
          result: {
            message: '',
          },
        };
      } catch (error) {
        // Clear force transport type on device connection error
        void backgroundApiProxy.serviceHardwareUI.cleanHardwareUiState();
        console.error('handleDeviceConnect error:', error);
        throw error;
      }
    },
    [
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
      intl,
      ensureActiveConnection,
      fwUpdateActions,
      showFirmwareVerifyDialog,
      prepareUSBConnect,
      getActiveDevice,
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
      await ensureActiveConnection(device);
      const currentDevice = getActiveDevice() ?? device;
      void backgroundApiProxy.serviceHardwareUI.showDeviceProcessLoadingDialog({
        connectId: currentDevice.connectId ?? '',
      });

      let features: IOneKeyDeviceFeatures | undefined;

      try {
        features =
          await backgroundApiProxy.serviceHardware.getFeaturesWithUnlock({
            connectId: currentDevice.connectId ?? '',
          });
      } catch (error) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        throw error;
      }

      const deviceState = extractDeviceState(features);
      const strategy = await determineWalletCreationStrategy(
        deviceState,
        currentDevice,
      );

      console.log('Current hardware wallet State', deviceState, strategy);
      if (!strategy) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        throw new OneKeyLocalError({
          message: intl.formatMessage({
            id: ETranslations.hardware_user_cancel_error,
          }),
        });
      }

      await createHwWallet(
        currentDevice,
        strategy,
        features,
        isFirmwareVerified,
        deviceState,
      );
    },
    [
      ensureActiveConnection,
      getActiveDevice,
      extractDeviceState,
      determineWalletCreationStrategy,
      createHwWallet,
      closeDialogAndReturn,
      intl,
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
      ensureActiveConnection,
      getActiveDevice,
      getActiveDeviceFeatures,
    }),
    [
      connectDevice,
      ensureStopScan,
      verifyHardware,
      onSelectAddWalletType,
      ensureActiveConnection,
      getActiveDevice,
      getActiveDeviceFeatures,
    ],
  );
}

export const useConnectDeviceError = (
  onError: (errorMessageId: ETranslations) => void,
) => {
  const uiRequestCallback = throttle(
    ({ uiRequestType }: { uiRequestType: EHardwareUiStateAction }) => {
      if (uiRequestType === EHardwareUiStateAction.BLUETOOTH_PERMISSION) {
        onError(ETranslations.onboarding_enable_bluetooth);
      } else if (
        uiRequestType ===
        EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE
      ) {
        onError(
          platformEnv.isNativeIOS
            ? ETranslations.feedback_try_toggling_bluetooth
            : ETranslations.feedback_try_repairing_device_in_settings,
        );
      } else if (
        uiRequestType ===
        EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION
      ) {
        onError(ETranslations.device_not_connected);
      }
    },
    2500,
  );
  appEventBus.on(EAppEventBusNames.RequestHardwareUIDialog, uiRequestCallback);
  return () => {
    appEventBus.off(
      EAppEventBusNames.RequestHardwareUIDialog,
      uiRequestCallback,
    );
  };
};

export enum EBluetoothStatus {
  checking = 'checking',
  enabled = 'enabled',
  disabledInSystem = 'disabledInSystem',
  disabledInApp = 'disabledInApp',
  noSystemPermission = 'noSystemPermission',
}
export const useDesktopBluetoothStatusPolling = platformEnv.isSupportDesktopBle
  ? (
      tabValue: EConnectDeviceChannel,
      onChangeBluetoothStatus: (status: EBluetoothStatus) => void,
    ) => {
      const nobleInitializedRef = useRef(false);
      const isConnectingRef = useRef(false);
      const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
      );

      const checkBluetoothStatus = useCallback(async () => {
        try {
          // Ensure Noble is initialized before checking status
          if (!nobleInitializedRef.current) {
            try {
              console.log(
                'onboarding checkBluetoothStatus: noble pre-initialization',
              );
              await globalThis?.desktopApi?.nobleBle?.checkAvailability();
            } catch (error) {
              console.log(
                'Noble pre-initialization completed with expected error:',
                error,
              );
            }
            nobleInitializedRef.current = true;
          }

          // Desktop platform: check desktop bluetooth availability
          const enableDesktopBluetoothInApp =
            await backgroundApiProxy.serviceSetting.getEnableDesktopBluetooth();
          if (!enableDesktopBluetoothInApp) {
            console.log('onboarding checkBluetoothStatus: disabledInApp');
            onChangeBluetoothStatus(EBluetoothStatus.disabledInApp);
            return;
          }

          const available =
            await globalThis?.desktopApi?.nobleBle?.checkAvailability();
          if (available.state === 'unknown') {
            return;
          }
          if (available.state === 'unauthorized') {
            console.log('onboarding checkBluetoothStatus: noSystemPermission');
            onChangeBluetoothStatus(EBluetoothStatus.noSystemPermission);
            return;
          }
          if (!available?.available) {
            console.log('onboarding checkBluetoothStatus: disabledInSystem');
            onChangeBluetoothStatus(EBluetoothStatus.disabledInSystem);
            return;
          }

          console.log('onboarding checkBluetoothStatus: enabled');
          await backgroundApiProxy.serviceSetting.setDesktopBluetoothAtom({
            isRequestedPermission: true,
          });
          // All checks passed
          onChangeBluetoothStatus(EBluetoothStatus.enabled);
        } catch (error) {
          console.error('Desktop bluetooth check failed:', error);
          onChangeBluetoothStatus(EBluetoothStatus.disabledInSystem);
        }
      }, [onChangeBluetoothStatus]);

      const startBluetoothStatusPolling = useCallback(() => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
        }

        pollingTimerRef.current = setInterval(() => {
          // Don't poll if connecting to a device
          if (!isConnectingRef.current) {
            void checkBluetoothStatus();
          }
        }, 1500);
      }, [checkBluetoothStatus]);

      const stopBluetoothStatusPolling = useCallback(() => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }, []);

      const setIsConnecting = useCallback((isConnecting: boolean) => {
        isConnectingRef.current = isConnecting;
      }, []);

      const isFocused = useIsFocused();

      // Check bluetooth status on mount and when focused, start polling
      useEffect(() => {
        if (tabValue !== EConnectDeviceChannel.bluetooth) {
          return;
        }
        if (isFocused) {
          void checkBluetoothStatus();
          startBluetoothStatusPolling();
        } else {
          stopBluetoothStatusPolling();
        }

        return () => {
          stopBluetoothStatusPolling();
        };
      }, [
        checkBluetoothStatus,
        isFocused,
        startBluetoothStatusPolling,
        stopBluetoothStatusPolling,
        tabValue,
      ]);
      return useMemo(() => {
        return {
          checkBluetoothStatus,
          setIsConnecting,
        };
      }, [checkBluetoothStatus, setIsConnecting]);
    }
  : () => {
      return useMemo(() => {
        return {
          checkBluetoothStatus: noop,
          setIsConnecting: noop,
        };
      }, []);
    };
