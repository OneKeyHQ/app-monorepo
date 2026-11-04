import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { isHardwareCloudSyncPlatformSupported } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { HardwareCloudSyncDevicePicker } from './HardwareCloudSyncDevicePicker';

import type { IntlShape } from 'react-intl';

export type ICloudSyncKeyChoice = 'keyless' | 'hardware';

// Asked only when sync is turned on; resolves undefined when dismissed.
export function chooseCloudSyncKey(
  intl: IntlShape,
): Promise<ICloudSyncKeyChoice | undefined> {
  return new Promise((resolve) => {
    let choice: ICloudSyncKeyChoice | undefined;
    let close: () => Promise<void> = async () => undefined;
    const pick = async (value: ICloudSyncKeyChoice) => {
      choice = value;
      await close();
    };
    const dialog = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.cloud_sync_choose_encryption__title,
      }),
      showFooter: false,
      contentContainerProps: { px: 0 },
      renderContent: (
        <YStack>
          <ListItem
            testID="cloud-sync-key-keyless"
            icon="Wallet4Outline"
            title={intl.formatMessage({ id: ETranslations.keyless_wallet })}
            subtitle={intl.formatMessage({
              id: ETranslations.cloud_sync_keyless_option__desc,
            })}
            drillIn
            onPress={() => pick('keyless')}
          />
          <ListItem
            testID="cloud-sync-key-hardware"
            icon="OnekeyProOutline"
            title={intl.formatMessage({
              id: ETranslations.hardware_wallet__title,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.cloud_sync_hardware_option__desc,
            })}
            drillIn
            onPress={() => pick('hardware')}
          />
        </YStack>
      ),
      onClose: () => resolve(choice),
    });
    close = async () => {
      await dialog.close();
    };
  });
}

// Shown while the user confirms on the device; counts the confirmations, as
// in "Confirm on device (1/3)", once the first one is asked for.
function DeviceConfirmWaiting() {
  const intl = useIntl();
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  }>();
  useEffect(() => {
    const onProgress = (value: { current: number; total: number }) => {
      setProgress(value);
    };
    appEventBus.on(EAppEventBusNames.HardwareCloudKeySignProgress, onProgress);
    return () => {
      appEventBus.off(
        EAppEventBusNames.HardwareCloudKeySignProgress,
        onProgress,
      );
    };
  }, []);
  const title = intl.formatMessage({
    id: ETranslations.global_confirm_on_device,
  });
  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>
          {progress
            ? `${title} (${progress.current}/${progress.total})`
            : title}
        </Dialog.Title>
        {/* Shown while the user is signing, so the risk note lands here. */}
        <Dialog.Description>
          {intl.formatMessage({
            id: ETranslations.cloud_sync_hardware_signing__desc,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <Spinner size="large" />
    </YStack>
  );
}

function confirmDialog({
  title,
  description,
  onConfirmText,
  destructive,
}: {
  title: string;
  description: string;
  onConfirmText: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    Dialog.show({
      title,
      description,
      onConfirmText,
      ...(destructive ? { tone: 'destructive' as const } : {}),
      onConfirm: () => {
        confirmed = true;
      },
      onClose: () => resolve(confirmed),
    });
  });
}

// The device holds another recovery phrase than the one sync was turned on
// with; continuing rebuilds the Cloud data with this hardware wallet.
function confirmSwitchDevice(intl: IntlShape) {
  return confirmDialog({
    title: intl.formatMessage({
      id: ETranslations.cloud_sync_hardware_mismatch__title,
    }),
    description: intl.formatMessage({
      id: ETranslations.cloud_sync_hardware_wallet_mismatch__msg,
    }),
    onConfirmText: intl.formatMessage({ id: ETranslations.global_continue }),
  });
}

function confirmSwitchToWebUsb(intl: IntlShape) {
  return confirmDialog({
    title: intl.formatMessage({
      id: ETranslations.cloud_sync_switch_to_webusb__title,
    }),
    description: intl.formatMessage({
      id: ETranslations.cloud_sync_switch_to_webusb__desc,
    }),
    onConfirmText: intl.formatMessage({ id: ETranslations.global_switch }),
  });
}

export function useHardwareCloudSyncKey() {
  const intl = useIntl();
  const [config] = usePrimeCloudSyncPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const [pending, setPending] = useState(false);
  const supported = isHardwareCloudSyncPlatformSupported();
  const source = supported ? config.hardwareCloudSyncKeySource : undefined;
  // Sync can stay on without its key, e.g. after an older App version ran or
  // another device reset it. Opening the page asks the server first.
  const { result: keyMissing = false, run: recheckKeyMissing } =
    usePromiseResult(
      async () => {
        if (!source?.credentialId || !config.isCloudSyncEnabledKeyless) {
          return false;
        }
        await backgroundApiProxy.serviceKeylessCloudSync.checkHardwareCloudSyncSessionThrottled(
          { force: true },
        );
        return backgroundApiProxy.serviceKeylessCloudSync.isSelectedHardwareCloudKeyMissing();
      },
      [source?.credentialId, config.isCloudSyncEnabledKeyless],
      { revalidateOnFocus: true },
    );
  useEffect(() => {
    const onDropped = () => {
      void recheckKeyMissing();
    };
    appEventBus.on(EAppEventBusNames.HardwareCloudKeyDropped, onDropped);
    return () => {
      appEventBus.off(EAppEventBusNames.HardwareCloudKeyDropped, onDropped);
    };
  }, [recheckKeyMissing]);
  useEffect(
    () => () => {
      void backgroundApiProxy.serviceKeylessCloudSync.cancelHardwareCloudKeyOperation();
    },
    [],
  );
  const signWithDevice = useCallback(
    async (connectId: string, switchDevice: boolean) => {
      setPending(true);
      let finished = false;
      // Stays up while the device asks for the signature; Cancel stops that
      // request. A late cancel after the commit starts is ignored.
      const waiting = Dialog.show({
        showConfirmButton: false,
        dismissOnOverlayPress: false,
        disableDrag: true,
        renderContent: <DeviceConfirmWaiting />,
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onClose: async () => {
          if (!finished) {
            await backgroundApiProxy.serviceKeylessCloudSync.cancelHardwareCloudKeyOperation();
          }
        },
      });
      // The signature is done once the sync loading shows; hand over to it so
      // the two dialogs never stack.
      const onSyncLoading = () => {
        finished = true;
        void waiting.close();
      };
      appEventBus.once(EAppEventBusNames.ShowDialogLoading, onSyncLoading);
      try {
        await backgroundApiProxy.serviceKeylessCloudSync.enableHardwareCloudSync(
          { connectId, switchDevice },
        );
      } finally {
        appEventBus.off(EAppEventBusNames.ShowDialogLoading, onSyncLoading);
        finished = true;
        void waiting.close();
        setPending(false);
      }
    },
    [intl],
  );
  const enableWithDevice = useCallback(
    async (connectId: string) => {
      try {
        try {
          await signWithDevice(connectId, false);
        } catch (error) {
          if (
            (error as IOneKeyError | undefined)?.key !==
              ETranslations.cloud_sync_hardware_wallet_mismatch__msg ||
            !(await confirmSwitchDevice(intl))
          ) {
            throw error;
          }
          await signWithDevice(connectId, true);
        }
      } finally {
        // The scan forced the transport it found the device on.
        void backgroundApiProxy.serviceHardware.clearForceTransportType();
      }
    },
    [intl, signWithDevice],
  );
  const resetWithDevice = useCallback(
    async function resetWithDeviceFlow(
      connectId: string,
      targetCredentialId?: string,
      overwriteTargetSnapshot?: string,
    ): Promise<void> {
      setPending(true);
      let finished = false;
      const waiting = Dialog.show({
        showConfirmButton: false,
        dismissOnOverlayPress: false,
        disableDrag: true,
        renderContent: <DeviceConfirmWaiting />,
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onClose: async () => {
          if (!finished) {
            await backgroundApiProxy.serviceKeylessCloudSync.cancelHardwareCloudKeyOperation();
          }
        },
      });
      const onSyncLoading = () => {
        finished = true;
        void waiting.close();
      };
      appEventBus.once(EAppEventBusNames.ShowDialogLoading, onSyncLoading);
      try {
        await backgroundApiProxy.serviceKeylessCloudSync.resetHardwareCloudSyncKey(
          {
            connectId,
            ...(targetCredentialId ? { targetCredentialId } : {}),
            ...(overwriteTargetSnapshot ? { overwriteTargetSnapshot } : {}),
          },
        );
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.sync_key_changed__title,
          }),
        });
      } catch (error) {
        const failure = error as
          | IOneKeyError<{
              targetCredentialId?: string;
              targetSnapshotHash?: string;
            }>
          | undefined;
        const target = failure?.info?.targetCredentialId;
        const snapshot = failure?.info?.targetSnapshotHash;
        const switchRequired =
          !targetCredentialId &&
          failure?.key ===
            ETranslations.cloud_sync_hardware_wallet_mismatch__msg;
        const overwriteRequired =
          target === targetCredentialId &&
          failure?.key ===
            ETranslations.cloud_sync_hardware_switch_target_has_data__msg &&
          !!snapshot &&
          /^[\da-f]{64}$/.test(snapshot);
        if (
          (!switchRequired && !overwriteRequired) ||
          !target ||
          !/^hardware-cloud-v1-[\da-f]{64}$/.test(target)
        ) {
          if (
            failure?.key ===
              ETranslations.cloud_sync_hardware_wallet_mismatch__msg ||
            failure?.key ===
              ETranslations.cloud_sync_hardware_switch_target_has_data__msg
          ) {
            errorToastUtils.showToastOfError({ ...failure, autoToast: true });
          }
          throw error;
        }
        finished = true;
        await waiting.close();
        const confirmed = await confirmDialog(
          overwriteRequired
            ? {
                title: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_overwrite__title,
                  defaultMessage: "Replace this wallet's cloud data?",
                }),
                description: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_switch_target_has_data__msg,
                  defaultMessage:
                    "This wallet already has synced data. Continuing will replace its cloud data with your current synced data. This can't be undone.",
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_overwrite__action,
                  defaultMessage: 'Replace data',
                }),
                destructive: true,
              }
            : {
                title: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_switch__title,
                  defaultMessage: 'Switch hardware wallet?',
                }),
                description: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_switch__desc,
                  defaultMessage:
                    "Your synced data will use this wallet's key. The original cloud copy will be kept. Connect the new wallet on other clients to sync future changes.",
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.cloud_sync_hardware_switch__action,
                  defaultMessage: 'Switch wallet',
                }),
              },
        );
        if (confirmed)
          await resetWithDeviceFlow(
            connectId,
            target,
            overwriteRequired ? snapshot : undefined,
          );
      } finally {
        finished = true;
        appEventBus.off(EAppEventBusNames.ShowDialogLoading, onSyncLoading);
        void waiting.close();
        setPending(false);
        void backgroundApiProxy.serviceHardware.clearForceTransportType();
      }
    },
    [intl],
  );
  const pickDevice = useCallback(
    async (onPick: (connectId: string) => Promise<void>) => {
      if (
        (platformEnv.isWeb || platformEnv.isExtension) &&
        settings.hardwareTransportType !== EHardwareTransportType.WEBUSB
      ) {
        // Bridge is never used for the Cloud key; offer the direct connection.
        if (!(await confirmSwitchToWebUsb(intl))) return;
        await backgroundApiProxy.serviceHardware.switchTransport({
          transportType: EHardwareTransportType.WEBUSB,
        });
        await backgroundApiProxy.serviceSetting.setHardwareTransportType(
          EHardwareTransportType.WEBUSB,
        );
      }
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel ||
        platformEnv.isExtensionUiStandaloneWindow
      ) {
        // The USB chooser opens only in a full tab, as in onboarding.
        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          routes: [
            ERootRoutes.Modal,
            EModalRoutes.PrimeModal,
            EPrimePages.PrimeCloudSync,
          ],
        });
        return;
      }
      let picked = false;
      let dismissed = false;
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_connect_hardware_wallet,
        }),
        showFooter: false,
        boundedSheetLayout: true,
        sheetDragArea: 'header',
        contentContainerProps: { pt: '$3', pb: '$5' },
        renderContent: (
          <HardwareCloudSyncDevicePicker
            onPick={async (connectId) => {
              // A connection can finish after the user dismisses the picker.
              if (dismissed) return;
              picked = true;
              await dialog.close();
              try {
                await onPick(connectId);
              } catch (error) {
                // The flow already reports its own failures (service toasts or
                // the switch dialog); stop them here so they do not surface as
                // unhandled rejections from the picker's Connect button.
                errorUtils.autoPrintErrorIgnore(error);
              }
            }}
          />
        ),
        onClose: () => {
          dismissed = true;
          if (!picked) {
            void backgroundApiProxy.serviceHardware.clearForceTransportType();
          }
        },
      });
    },
    [intl, settings.hardwareTransportType],
  );
  const openPicker = useCallback(
    () => pickDevice(enableWithDevice),
    [enableWithDevice, pickDevice],
  );
  const resetKey = useCallback(async () => {
    const confirmed = await confirmDialog({
      title: intl.formatMessage({ id: ETranslations.change_sync_key__title }),
      description: intl.formatMessage({
        id: ETranslations.change_sync_key__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.change_sync_key__action,
      }),
    });
    if (!confirmed) return;
    await pickDevice(resetWithDevice);
  }, [intl, pickDevice, resetWithDevice]);
  const syncNow = useCallback(async () => {
    await backgroundApiProxy.serviceApp.showDialogLoading({
      title: intl.formatMessage({ id: ETranslations.global_syncing }),
    });
    let success = false;
    try {
      success = await backgroundApiProxy.servicePrimeCloudSync.syncNowKeyless({
        callerName: 'Manual hardware Cloud sync',
        noDebounceUpload: true,
        forceSync: true,
        askPasswordOnlyIfHdXfpMissing: true,
      });
    } finally {
      await timerUtils.wait(1000);
      await backgroundApiProxy.serviceApp.hideDialogLoading();
    }
    void backgroundApiProxy.serviceApp.showToast({
      method: success ? 'success' : 'error',
      title: intl.formatMessage({
        id: success
          ? ETranslations.global_sync_successfully
          : ETranslations.global_sync_error,
      }),
    });
  }, [intl]);
  return {
    supported,
    source,
    keyMissing,
    pending,
    openPicker,
    resetKey,
    syncNow,
  };
}
