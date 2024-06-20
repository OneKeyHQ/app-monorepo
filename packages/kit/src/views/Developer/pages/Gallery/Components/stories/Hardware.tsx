/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */

import { Button, Dialog, SizableText, Stack } from '@onekeyhq/components';
import {
  ConfirmOnDeviceToast,
  confirmByPin,
  confirmOnDeviceToastSample,
  confirmPassphrase,
  confirmPhrase,
  confirmPhraseOnDevice,
  confirmPinOnDevice,
} from '@onekeyhq/kit/src/components/Hardware';
import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IHardwareUiPayload } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import { Layout } from './utils/Layout';

import type { IDeviceType } from '@onekeyfe/hd-core';

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
      deviceType: deviceType ?? 'pro',
      deviceId: '123',
      connectId: '123',
      deviceMode: EOneKeyDeviceMode.normal,
      isBootloaderMode: false,
      passphraseState: undefined,
      supportInputPinOnSoftware: true,
      rawPayload: undefined,
    };

    if (uiRequestType === EHardwareUiStateAction.FIRMWARE_TIP) {
      usedPayload.firmwareTipData = payload;
    }
    if (uiRequestType === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
      usedPayload.firmwareProgress = payload;
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
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          Confirm =》Confirm =》Pin =》Pin =》Confirm =》Confirm =》Pin
          =》Confirm
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
          Test Hardware Action Dialog & Toast (Count 8)
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          Pin =》Passphrase =》Pin On Device =》Passphrase On Device =》 Pin
          =》Passphrase
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.REQUEST_PASSPHRASE);
            await generateAction(EHardwareUiStateAction.EnterPinOnDevice);
            await generateAction(
              EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE,
            );
            await generateAction(EHardwareUiStateAction.REQUEST_PIN);
            await generateAction(EHardwareUiStateAction.REQUEST_PASSPHRASE);
          }}
        >
          Test Hardware Action Dialog (Count 6)
        </Button>
      </Stack>

      <Stack gap="$2">
        <SizableText textAlign="left" size="$bodySmMedium" color="$text">
          Confirm =》Confirm Classic =》Confirm =》Confirm =》Confirm mini
          =》Confirm touch
        </SizableText>
        <Button
          onPress={async () => {
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
              deviceType: 'classic',
            });
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.REQUEST_BUTTON);
            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
              deviceType: 'mini',
            });
            await generateAction(EHardwareUiStateAction.FIRMWARE_TIP, {
              payload: {
                message: 'ConfirmOnDevice',
              },
              deviceType: 'touch',
            });
          }}
        >
          Test Hardware Action Toast (Count 6)
        </Button>
      </Stack>
    </Stack>
  );
};

const HardwareGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Interactive with hardware wallet',
        element: () => (
          <Stack space="$4">
            <Button
              onPress={() => {
                void confirmOnDeviceToastSample();
              }}
            >
              Confirm On Device (Toast)
            </Button>

            <Button
              onPress={() => {
                void ConfirmOnDeviceToast({ deviceType: 'classic' });
              }}
            >
              Confirm On Classic (Toast)
            </Button>

            <Button
              onPress={() => {
                void ConfirmOnDeviceToast({ deviceType: 'touch' });
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
          </Stack>
        ),
      },
    ]}
  />
);

export default HardwareGallery;
