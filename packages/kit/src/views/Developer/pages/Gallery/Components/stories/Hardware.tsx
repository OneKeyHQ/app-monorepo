/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */

import { useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  Button,
  Dialog,
  EInPageDialogType,
  SizableText,
  Stack,
  useInPageDialog,
} from '@onekeyhq/components';
import {
  ConfirmOnDeviceToast,
  confirmByPin,
  confirmOnDeviceToastSample,
  confirmPassphrase,
  confirmPhrase,
  confirmPhraseOnDevice,
  confirmPinOnDevice,
} from '@onekeyhq/kit/src/components/Hardware';
import { hardwareUiStateDialogLifecycle } from '@onekeyhq/kit/src/provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import type { IHardwareUiPayload } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import { Layout } from './utils/Layout';

import type { IDeviceType } from '@onekeyfe/hd-core';
// https://i.mij.rip/2024/09/19/b0cdcbdb45494fe53b831fff02981fdb.jpeg

const BootloaderDialogHandoffTest = () => {
  const [confirmCount, setConfirmCount] = useState(0);
  const dialogHost = useInPageDialog(EInPageDialogType.inOnboardingPage);
  const firmwareUpdateActions = useFirmwareUpdateActions();

  return (
    <Stack gap="$2">
      <Button
        testID="hardware-bootloader-dialog-handoff-demo-button"
        onPress={async () => {
          const payload: IHardwareUiPayload = {
            uiRequestType: EHardwareUiStateAction.DeviceChecking,
            eventType: '',
            deviceType: EDeviceType.Classic1s,
            deviceId: 'bootloader-handoff-test',
            connectId: 'bootloader-handoff-test',
            deviceMode: EOneKeyDeviceMode.bootloader,
            isBootloaderMode: true,
            passphraseState: undefined,
            rawPayload: undefined,
          };

          const openLegacyState = () =>
            hardwareUiStateAtom.set({
              action: EHardwareUiStateAction.DeviceChecking,
              connectId: payload.connectId,
              payload,
            });
          // Same gate as production call sites: the wait is for the legacy
          // Sheet's mount acknowledgement — with the stage owning the surface
          // no Sheet mounts and openAndWait can only time out (OK-59934).
          if (platformEnv.isNativeIOS && isLegacyHardwareUiActive()) {
            await hardwareUiStateDialogLifecycle.openAndWait(openLegacyState);
          } else {
            await openLegacyState();
          }
          await timerUtils.wait(500);
          await hardwareUiStateDialogLifecycle.closeAndWait(() =>
            hardwareUiStateAtom.set(undefined),
          );

          firmwareUpdateActions.showBootloaderMode({
            connectId: payload.connectId,
            existsFirmware: false,
            dialogHost,
            onBeforeUpdate: async () => {
              setConfirmCount((count) => count + 1);
              return undefined;
            },
          });
        }}
      >
        Test Bootloader Dialog Handoff ({confirmCount})
      </Button>
      <SizableText testID="hardware-bootloader-dialog-handoff-result">
        Confirm count: {confirmCount}
      </SizableText>
    </Stack>
  );
};

const HardwareActionTest = () => {
  const generateAction = async (
    uiRequestType: EHardwareUiStateAction,
    options?: {
      deviceType?: IDeviceType;
      payload?: any;
    },
  ) => {
    const { deviceType, payload } = options || {};
    const usedPayload: IHardwareUiPayload = {
      uiRequestType,
      eventType: '',
      deviceType: deviceType ?? EDeviceType.Pro,
      deviceId: '123',
      connectId: '123',
      deviceMode: EOneKeyDeviceMode.normal,
      isBootloaderMode: false,
      passphraseState: undefined,
      rawPayload: undefined,
    };

    if (uiRequestType === EHardwareUiStateAction.FIRMWARE_TIP) {
      usedPayload.firmwareTipData = payload;
    }
    if (uiRequestType === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
      usedPayload.firmwareProgress = payload;
    }
    if (uiRequestType === EHardwareUiStateAction.DEVICE_PROGRESS) {
      usedPayload.deviceProgress = payload;
    }

    if (
      ![
        // skip events
        EHardwareUiStateAction.CLOSE_UI_WINDOW,
        EHardwareUiStateAction.PREVIOUS_ADDRESS,
      ].includes(uiRequestType)
    ) {
      // show hardware ui dialog
      await hardwareUiStateAtom.set({
        action: uiRequestType,
        connectId: '123',
        payload: usedPayload,
      });
    }
    await hardwareUiStateCompletedAtom.set({
      action: uiRequestType,
      connectId: '123',
      payload: usedPayload,
    });
  };

  return (
    <Stack gap="$6">
      <Stack gap="$2">
        <BootloaderDialogHandoffTest />
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          Device transfer progress
        </SizableText>
        <Button
          testID="hardware-device-progress-demo-button"
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.DEVICE_PROGRESS, {
              payload: {
                progress: 42,
                transferredBytes: 420,
                totalBytes: 1000,
                rateBytesPerSecond: 210,
                elapsedMs: 2000,
              },
              deviceType: EDeviceType.Pro2,
            });
          }}
        >
          Test Device Transfer Progress
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          事件：Confirm =》Confirm =》Pin =》Pin =》Confirm =》Confirm =》Pin
          =》Confirm
        </SizableText>
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          实际：Confirm =》Pin =》Confirm =》Pin =》Confirm
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
            });
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
          }}
        >
          Test Hardware Action Dialog (Test 1)
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          事件：Pin =》Pin On Device
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.EnterPinOnDevice);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);

            // await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            // await generateAction(EHardwareUiStateAction.REQUEST_PASSPHRASE);
            // await generateAction(EHardwareUiStateAction.EnterPinOnDevice);
            // await generateAction(
            //   EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE,
            // );
            // await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            // await generateAction(EHardwareUiStateAction.REQUEST_PASSPHRASE);
          }}
        >
          Test Hardware Action Dialog (Test 2)
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          事件：Confirm =》Confirm Classic =》FIRMWARE_PROGRESS
          =》FIRMWARE_PROGRESS
        </SizableText>
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          实际：Confirm =》Confirm Classic
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);

            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
              deviceType: EDeviceType.Classic,
            });

            await generateAction(EHardwareUiStateAction.FIRMWARE_PROGRESS);
            await generateAction(EHardwareUiStateAction.FIRMWARE_PROGRESS);
          }}
        >
          Test Hardware Action Toast (Count 3)
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          事件：Confirm =》Confirm Classic =》FIRMWARE_PROGRESS
          =》FIRMWARE_PROGRESS
        </SizableText>
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          实际：Confirm =》Confirm Classic
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.FIRMWARE_PROGRESS, {
              payload: 100,
            });
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);

            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
              deviceType: EDeviceType.Pro,
            });
            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: '"InstallingFirmware"',
              },
              deviceType: EDeviceType.Pro,
            });
          }}
        >
          Install Firmware Event (Test 1)
        </Button>
      </Stack>
    </Stack>
  );
};

const HardwareGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Hardware"
    elements={[
      {
        title: 'Interactive with hardware wallet',
        element: () => (
          <Stack gap="$4">
            <Button
              onPress={() => {
                void confirmOnDeviceToastSample();
              }}
            >
              Confirm On Device (Toast)
            </Button>

            <Button
              onPress={() => {
                void ConfirmOnDeviceToast({ deviceType: EDeviceType.Classic });
              }}
            >
              Confirm On Classic (Toast)
            </Button>

            <Button
              onPress={() => {
                void ConfirmOnDeviceToast({ deviceType: EDeviceType.Touch });
              }}
            >
              Confirm On Touch (Toast)
            </Button>

            <Button
              onPress={() => {
                void confirmPinOnDevice();
              }}
            >
              Enter PIN on Device
            </Button>
            <Button
              onPress={() => {
                void confirmByPin();
              }}
            >
              Enter PIN
            </Button>

            <Button
              onPress={() => {
                void confirmPhraseOnDevice();
              }}
            >
              Enter Passphrase on Device
            </Button>
            <Button
              onPress={() => {
                void confirmPhrase();
              }}
            >
              Enter Passphrase
            </Button>

            <Button
              onPress={() => {
                void confirmPassphrase();
              }}
            >
              Confirm Passphrase
            </Button>
            <HardwareActionTest />
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'Test Hardware Action',
                  renderContent: <HardwareActionTest />,
                })
              }
            >
              Test Hardware Action Dialog & Toast from Dialog
            </Button>
            <Button
              onPress={async () => {
                const hex = await deviceHomeScreenUtils.imagePathToHex(
                  'https://i.mij.rip/2024/09/19/b0cdcbdb45494fe53b831fff02981fdb.jpeg',
                  EDeviceType.Classic,
                );
                console.log(hex);
              }}
            >
              Test HomeScreen imagePathToHex
            </Button>
          </Stack>
        ),
      },
    ]}
  />
);

export default HardwareGallery;
