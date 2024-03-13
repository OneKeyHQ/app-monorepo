/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */

import { Button, Stack } from '@onekeyhq/components';
import {
  confirmByPin,
  ConfirmOnDeviceToast,
  confirmOnDevice,
  confirmPassphrase,
  confirmPhrase,
  confirmPhraseOnDevice,
  confirmPinOnDevice,
} from '@onekeyhq/kit/src/components/Hardware';

import { Layout } from './utils/Layout';

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
                void confirmOnDevice();
              }}
            >
              Confirm On Device
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
          </Stack>
        ),
      },
    ]}
  />
);

export default HardwareGallery;
