/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { StyleSheet } from 'react-native';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Dialog,
  Form,
  IconButton,
  Input,
  LottieView,
  SizableText,
  Stack,
  Toast,
  XStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { useConfirmOnHardWare } from '@onekeyhq/kit/src/hooks/useHardware';

import { Layout } from './utils/Layout';

const HardwareGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Interactive with hardware wallet',
        element: () => {
          const {
            confirmOnClassic,
            confirmByPin,
            confirmPinOnDevice,
            confirmPhrase,
            confirmPassphrase,
            confirmPhraseOnDevice,
          } = useConfirmOnHardWare();
          return (
            <Stack space="$4">
              <Button
                onPress={() => {
                  void confirmOnClassic();
                }}
              >
                Confirm On Device
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
          );
        },
      },
    ]}
  />
);

export default HardwareGallery;
