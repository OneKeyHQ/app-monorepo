import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type HardwareConnectProtocol,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';
import { useIsFocused } from '@react-navigation/core';
import { get, noop, throttle } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { projectLegacyDeviceFeaturesFromState } from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type {
  IFirmwareVerifyResult,
  IOneKeyDeviceFeatures,
  IOneKeyDeviceState,
} from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import { hardwareUiStateDialogLifecycle } from '../../../provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import { bootloaderModeDialogManager } from '../../FirmwareUpdate/hooks/bootloaderModeDialogManager';
import {
  type IBootloaderModeDialogHost,
  useFirmwareUpdateActions,
} from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareVerifyDialog } from '../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { useSelectAddWalletTypeDialog } from '../../Onboarding/pages/ConnectHardwareWallet/SelectAddWalletTypeDialog';
import {
  EHardwareWalletCreationMode,
  getWalletCreationDeviceState,
  resolveAutomaticWalletCreationMode,
  shouldCheckExistingStandardWallet,
} from '../../Onboarding/pages/ConnectHardwareWallet/walletCreationMode';
import {
  getForceTransportType,
  getHardwareCommunicationTypeString,
  trackHardwareWalletConnection,
} from '../utils';

import { resolveFirmwareReconnectDevice } from './firmwareReconnectUtils';
import { usePrepareUSBConnectForFirmwareUpdate } from './usePrepareUSBConnectForFirmwareUpdate';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';

// ---------------------------------------------------------------------------
// Third-party vendor helpers (Ledger today; Trezor would add sibling helpers
// here, NOT modify these). Kept as plain module-level functions so the
// useDeviceConnect hook stays focused on the OneKey path.
// ---------------------------------------------------------------------------

async function verifyLedgerDevice(
  device: SearchDevice,
): Promise<IFirmwareVerifyResult> {
  // Third-party devices do not go through OneKey firmware verify /
  // bootloader checks; return a synthetic verified result.
  return {
    verified: true,
    device,
    payload: {
      deviceType: device.deviceType,
      data: '',
      cert: '',
      signature: '',
    },
    result: {
      message: '',
    },
  };
}

async function createLedgerHwWallet({
  device,
  vendor,
  actions,
  navigation,
  hardwareTransportType,
  isSoftwareWalletOnlyUser,
}: {
  device: SearchDevice;
  vendor: EHardwareVendor;
  actions: ReturnType<typeof useAccountSelectorActions>;
  navigation: ReturnType<typeof useAppNavigation>;
  hardwareTransportType: EHardwareTransportType | undefined;
  isSoftwareWalletOnlyUser: boolean;
}): Promise<void> {
  try {
    navigation.push(EOnboardingPages.FinalizeWalletSetup);

    const params: IDBCreateHwWalletParamsBase & {
      vendor?: EHardwareVendor;
    } = {
      device,
      hideCheckingDeviceLoading: true,
      features: {
        deviceId: device.deviceId || '',
        vendor,
      } as unknown as IOneKeyDeviceFeatures,
      isFirmwareVerified: true,
      defaultIsTemp: true,
      vendor,
    };
    await actions.current.createHWWalletWithoutHidden(params);

    await trackHardwareWalletConnection({
      status: 'success',
      deviceType: device.deviceType,
      features: params.features,
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
    });
  } catch (error) {
    errorToastUtils.toastIfError(error);
    navigation.pop();
    throw error;
  }
}

export function useDeviceConnect({
  setCurrentDevice,
  getBootloaderDialogHost,
}: {
  setCurrentDevice?: React.Dispatch<
    React.SetStateAction<SearchDevice | undefined>
  >;
  getBootloaderDialogHost?: () => IBootloaderModeDialogHost | undefined;
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
      connectProtocol?: HardwareConnectProtocol,
      forceProtocolDetection?: boolean,
      forceFeaturesRefresh?: boolean,
    ) => {
      await ensureStopScan();
      try {
        const features = await backgroundApiProxy.serviceHardware.connect({
          connectProtocol,
          device,
          forceFeaturesRefresh,
          forceProtocolDetection,
          hardwareCallContext,
        });
        const confirmedConnectProtocol =
          features?.protocol === 'V1' || features?.protocol === 'V2'
            ? features.protocol
            : undefined;
        const connectedDevice: SearchDevice = {
          ...device,
          ...(confirmedConnectProtocol
            ? { connectProtocol: confirmedConnectProtocol }
            : {}),
        };
        activeDeviceRef.current = connectedDevice;
        activeFeaturesRef.current = features ?? null;
        setCurrentDevice?.(connectedDevice);
        return features;
      } catch (error: any) {
        if (isOneKeyHardwareError(error)) {
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
    [ensureStopScan, setCurrentDevice],
  );

  const ensureActiveConnection = useCallback(
    async (
      device: SearchDevice,
      options?: {
        connectProtocol?: HardwareConnectProtocol;
        forceProtocolDetection?: boolean;
        forceReconnect?: boolean;
      },
    ) => {
      // If device was in bootloader mode, force reconnect to get fresh features
      const shouldForceReconnect =
        options?.forceReconnect || wasInBootloaderModeRef.current;

      if (
        !shouldForceReconnect &&
        isSameHardware(device, activeDeviceRef.current) &&
        activeFeaturesRef.current
      ) {
        await bootloaderModeDialogManager.close();
        return activeFeaturesRef.current;
      }

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

      const features = await connectDevice(
        device,
        hardwareCallContext,
        options?.connectProtocol,
        options?.forceProtocolDetection,
        Boolean(shouldForceReconnect),
      );
      let isConnectedBootloaderMode = false;
      if (features) {
        isConnectedBootloaderMode =
          await deviceUtils.isBootloaderModeByFeatures({ features });
        wasInBootloaderModeRef.current = isConnectedBootloaderMode;
        if (!isConnectedBootloaderMode) {
          await bootloaderModeDialogManager.close();
        }
      }
      const hasPlaceholderConnectId =
        !device.connectId || /^0+$/.test(device.connectId);
      if (
        hasPlaceholderConnectId &&
        isBootMode &&
        features &&
        !isConnectedBootloaderMode
      ) {
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

  const rebindDeviceAfterFirmwareUpdate = useCallback(
    async (
      previousDevice: SearchDevice,
      onConnectId?: (connectId: string) => void,
    ) => {
      wasInBootloaderModeRef.current = true;
      await ensureStopScan();
      const searchedDevices =
        await backgroundApiProxy.serviceHardware.searchDevices();
      if (!searchedDevices.success) {
        throw new OneKeyLocalError(
          'Unable to search for device after firmware update',
        );
      }

      const result = await resolveFirmwareReconnectDevice({
        previousDevice,
        devices: searchedDevices.payload,
        getFeatures: (connectId) =>
          backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
            connectId,
            params: {
              retryCount: 1,
              skipWebDevicePrompt: true,
            },
          }),
        onConnectId,
      });
      activeDeviceRef.current = { ...result.device };
      activeFeaturesRef.current = result.features;
      wasInBootloaderModeRef.current = false;
      await bootloaderModeDialogManager.close();
      setCurrentDevice?.(result.device);
      defaultLogger.hardware.sdkLog.log(
        'Firmware reconnect succeeded',
        JSON.stringify({
          deviceType: result.device.deviceType,
          commType: result.device.commType,
          connectIdChanged:
            previousDevice.connectId !== result.device.connectId,
        }),
      );
      return result;
    },
    [ensureStopScan, setCurrentDevice],
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

  const _handleNotActivatedDevicePress = useCallback(
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
                        testID="onboardingv2-package-alert-dialog-btn"
                        flex={1}
                        size="large"
                        $gtMd={{ size: 'medium' } as any}
                        onPress={() => showIntercom()}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_contact_us,
                        })}
                      </Button>
                      <Button
                        testID="onboardingv2-package-alert-dialog-btn"
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
    [handleRestoreWalletPress, handleSetupNewWalletPress, intl],
  );

  // Shared device connection handler
  const verifyHardware = useCallback(
    async (device: SearchDevice, tabValue: EConnectDeviceChannel) => {
      // Ensure all scanning and polling activities are stopped before connecting
      console.log('handleDeviceConnect: Starting device connection process');

      // Third-party vendor short-circuit: skip OneKey-specific verify
      // (firmware verify, bootloader check, etc.).
      const deviceVendor = (device as SearchDevice & { vendor?: string })
        ?.vendor;
      if (deviceVendor === EHardwareVendor.ledger) {
        return verifyLedgerDevice(device);
      }

      defaultLogger.account.wallet.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          hardwareWalletType: 'Standard',
          communication: getHardwareCommunicationTypeString(
            hardwareTransportType,
          ),
          vendor: EHardwareVendor.onekey,
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

      let connectionFailureTracked = false;
      let bootloaderDialogShown = false;
      let forceTransportType: EHardwareTransportType | undefined;
      const confirmedConnectProtocol = device.connectProtocol;
      try {
        const showCheckingDeviceDialog = () =>
          backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
            connectId: device.connectId ?? '',
            deviceType: device.deviceType ?? undefined,
            deviceName: device.name ?? undefined,
          });
        // The iOS wait is for the legacy Sheet's mount acknowledgement —
        // with the stage owning the surface no Sheet mounts, so waiting
        // can only time out and kill the flow (OK-59934).
        if (platformEnv.isNativeIOS && isLegacyHardwareUiActive()) {
          await hardwareUiStateDialogLifecycle.openAndWait(
            showCheckingDeviceDialog,
          );
        } else {
          void showCheckingDeviceDialog();
        }

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

          // Wait until the hardware dialog has left the global iOS overlay before
          // mounting the page-owned bootloader dialog.
          if (platformEnv.isNativeIOS) {
            await hardwareUiStateDialogLifecycle.closeAndWait(async () =>
              backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
                connectId: device.connectId ?? undefined,
                skipDeviceCancel: true,
                skipDelayClose: true,
                reason: 'open bootloader mode dialog',
              }),
            );
          }

          fwUpdateActions.showBootloaderMode({
            connectId: device.connectId ?? undefined,
            existsFirmware,
            onBeforeUpdate: prepareUSBForUpdate,
            dialogHost: getBootloaderDialogHost?.(),
          });
          bootloaderDialogShown = true;
          console.log('Device is in bootloader mode', device);
          // Bootloader mode hands off to the firmware-update flow, so the throw
          // below is not a connection failure — suppress the catch-block tracking.
          connectionFailureTracked = true;
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

        // Select transport for the current platform; native Bluetooth requires BLE.
        forceTransportType = await getForceTransportType(tabValue, {
          connectProtocol: confirmedConnectProtocol,
        });
        if (forceTransportType) {
          await backgroundApiProxy.serviceHardware.setForceTransportType({
            forceTransportType,
          });
        }

        const features = await ensureActiveConnection(
          device,
          confirmedConnectProtocol
            ? { connectProtocol: confirmedConnectProtocol }
            : { forceProtocolDetection: true },
        );
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
          connectionFailureTracked = true;
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
          connectionFailureTracked = true;
          Toast.error({
            title: 'Device is in backup mode',
          });
          throw new OneKeyLocalError('Device is in backup mode');
        }

        const shouldAuthenticateFirmware =
          await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
            device: {
              ...latestDevice,
              deviceId: deviceUtils.getRawDeviceId({
                device: latestDevice,
                features,
              }),
            },
          });

        if (shouldAuthenticateFirmware) {
          const closeCheckingDialogForVerify = async () =>
            backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
              connectId: latestDevice.connectId ?? '',
              hardClose: false,
              skipDelayClose: true,
              deviceResetToHome: false,
            });
          // Same handoff rule as the bootloader dialog above: wait until the
          // hardware checking dialog has fully left the global iOS overlay
          // before mounting the firmware verify dialog. Mounting while the old
          // Sheet is still exiting can strand its overlay above the new dialog,
          // and after a few genuine-check retries every tap gets swallowed.
          if (platformEnv.isNativeIOS) {
            await hardwareUiStateDialogLifecycle.closeAndWait(
              closeCheckingDialogForVerify,
            );
          } else {
            void closeCheckingDialogForVerify();
          }
          let isVerified: boolean | undefined;
          const result = await new Promise<IFirmwareVerifyResult>(
            (resolve, reject) => {
              void showFirmwareVerifyDialog({
                device: latestDevice,
                features,
                // iOS only, matching the closeAndWait gate above: the page
                // portal sits below the global overlay on every platform, so
                // without the awaited close an in-page dialog would sit under
                // the exiting checking sheet on Android/desktop. Those
                // platforms keep the global host (pre-existing behavior).
                dialogHost: platformEnv.isNativeIOS
                  ? getBootloaderDialogHost?.()
                  : undefined,
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
        };
      } catch (error) {
        // The hardware dialog was already closed before the bootloader dialog
        // mounted. A late cleanup write here can race with that handoff on iOS.
        if (!platformEnv.isNativeIOS || !bootloaderDialogShown) {
          void backgroundApiProxy.serviceHardwareUI.cleanHardwareUiState();
        }
        console.error('handleDeviceConnect error:', error);
        if (!connectionFailureTracked) {
          // Fire-and-forget; an analytics rejection must not mask the original error
          // in the catch, so we cannot await here.
          trackHardwareWalletConnection({
            status: 'failure',
            isSoftwareWalletOnlyUser,
            deviceType: device.deviceType,
            hardwareTransportType: forceTransportType || hardwareTransportType,
          }).catch((e) =>
            console.error('trackHardwareWalletConnection failed:', e),
          );
        }
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
      getBootloaderDialogHost,
    ],
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

  const determineWalletCreationStrategy = useCallback(
    async (
      deviceState: IOneKeyDeviceState,
      device: SearchDevice,
    ): Promise<EHardwareWalletCreationMode | null> => {
      const existsStandardWallet = shouldCheckExistingStandardWallet(
        deviceState,
      )
        ? await backgroundApiProxy.serviceAccount.existsHwStandardWallet({
            connectId: device.connectId ?? '',
            deviceId:
              deviceState.identity.deviceId ??
              deviceUtils.getRawDeviceId({ device }),
          })
        : false;
      const automaticMode = resolveAutomaticWalletCreationMode({
        state: deviceState,
        existsStandardWallet,
      });
      if (automaticMode) {
        return automaticMode;
      }

      const walletType = await showSelectAddWalletTypeDialog();
      if (walletType === 'Standard') {
        return EHardwareWalletCreationMode.Standard;
      }
      if (walletType === 'Hidden') {
        return EHardwareWalletCreationMode.Hidden;
      }

      return null;
    },
    [showSelectAddWalletTypeDialog],
  );

  const createHwWallet = useCallback(
    async (
      device: SearchDevice,
      walletMode: EHardwareWalletCreationMode,
      features: IOneKeyDeviceFeatures,
      isFirmwareVerified?: boolean,
      deviceState?: IOneKeyDeviceState,
      connectProtocol?: HardwareConnectProtocol,
    ) => {
      try {
        navigation.push(EOnboardingPages.FinalizeWalletSetup);

        const params: IDBCreateHwWalletParamsBase = {
          device,
          hideCheckingDeviceLoading: true,
          features,
          deviceState,
          connectProtocol,
          isFirmwareVerified,
          defaultIsTemp: true,
          isAttachPinMode: deviceState?.status.unlockedAttachPin ?? undefined,
        };
        if (walletMode === EHardwareWalletCreationMode.Standard) {
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
          deviceId: deviceUtils.getRawDeviceId({
            device,
            features,
            deviceState,
          }),
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
      vendor,
      connectProtocol,
    }: {
      device: SearchDevice;
      isFirmwareVerified?: boolean;
      vendor?: EHardwareVendor;
      connectProtocol?: HardwareConnectProtocol;
    }) => {
      // For third-party vendor devices (Ledger), skip OneKey SDK
      // connection/features flow and create wallet directly.
      if (vendor === EHardwareVendor.ledger) {
        return createLedgerHwWallet({
          device,
          vendor,
          actions,
          navigation,
          hardwareTransportType,
          isSoftwareWalletOnlyUser,
        });
      }

      const cachedProtocol = getActiveDeviceFeatures()?.protocol;
      const resolvedConnectProtocol =
        cachedProtocol === 'V1' || cachedProtocol === 'V2'
          ? cachedProtocol
          : connectProtocol;
      await ensureActiveConnection(device, {
        connectProtocol: resolvedConnectProtocol,
      });
      const currentDevice = getActiveDevice() ?? device;
      const showDeviceProcessLoadingDialog = () =>
        backgroundApiProxy.serviceHardwareUI.showDeviceProcessLoadingDialog({
          connectId: currentDevice.connectId ?? '',
        });
      // Same gate as the checking dialog above: the mount wait belongs to
      // the legacy Sheet alone (OK-59934).
      if (platformEnv.isNativeIOS && isLegacyHardwareUiActive()) {
        await hardwareUiStateDialogLifecycle.openAndWait(
          showDeviceProcessLoadingDialog,
        );
      } else {
        void showDeviceProcessLoadingDialog();
      }

      let features: IOneKeyDeviceFeatures | undefined;
      let deviceState: IOneKeyDeviceState;

      try {
        deviceState = await getWalletCreationDeviceState({
          serviceHardware: backgroundApiProxy.serviceHardware,
          connectId: currentDevice.connectId ?? '',
          connectProtocol: resolvedConnectProtocol,
        });
        features = projectLegacyDeviceFeaturesFromState(deviceState);
      } catch (error) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        throw error;
      }

      const strategy = await determineWalletCreationStrategy(
        deviceState,
        currentDevice,
      );

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
        resolvedConnectProtocol,
      );
    },
    [
      ensureActiveConnection,
      getActiveDevice,
      getActiveDeviceFeatures,
      determineWalletCreationStrategy,
      createHwWallet,
      closeDialogAndReturn,
      intl,
      navigation,
      actions,
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
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
      rebindDeviceAfterFirmwareUpdate,
      getActiveDevice,
      getActiveDeviceFeatures,
    }),
    [
      connectDevice,
      ensureStopScan,
      verifyHardware,
      onSelectAddWalletType,
      ensureActiveConnection,
      rebindDeviceAfterFirmwareUpdate,
      getActiveDevice,
      getActiveDeviceFeatures,
    ],
  );
}

export const useConnectDeviceError = (
  onError: (errorMessageId: ETranslations) => void,
) => {
  useEffect(() => {
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
    appEventBus.on(
      EAppEventBusNames.RequestHardwareUIDialog,
      uiRequestCallback,
    );
    return () => {
      uiRequestCallback.cancel();
      appEventBus.off(
        EAppEventBusNames.RequestHardwareUIDialog,
        uiRequestCallback,
      );
    };
  }, [onError]);
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
