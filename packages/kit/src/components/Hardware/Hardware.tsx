import { useMemo, useState } from 'react';

import { useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';

import type { IButtonProps, IColorTokens } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Form,
  IconButton,
  Input,
  LottieView,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  useMedia,
} from '@onekeyhq/components';

export const CONFIRM_ON_DEVICES = {
  classic: require('@onekeyhq/kit/assets/animations/confirm-on-classic.json'),
  mini: require('@onekeyhq/kit/assets/animations/confirm-on-mini.json'),
  proDark: require('@onekeyhq/kit/assets/animations/confirm-on-pro-dark.json'),
  proLight: require('@onekeyhq/kit/assets/animations/confirm-on-pro-light.json'),
  touch: require('@onekeyhq/kit/assets/animations/confirm-on-touch.json'),
};

export interface IConfirmOnDeviceToastContentProps {
  deviceType: keyof typeof CONFIRM_ON_DEVICES;
}
export function ConfirmOnDeviceToastContent({
  deviceType,
}: IConfirmOnDeviceToastContentProps) {
  return (
    <XStack alignItems="center">
      <Stack bg="$bgStrong" btlr="$2" bblr="$2">
        <LottieView
          width={72}
          height={72}
          source={CONFIRM_ON_DEVICES[deviceType]}
        />
      </Stack>
      <XStack flex={1} alignItems="center" px="$3" space="$5">
        <SizableText flex={1} size="$bodyLgMedium">
          Confirm on Device
        </SizableText>
        <Toast.Close>
          <IconButton size="small" icon="CrossedSmallOutline" />
        </Toast.Close>
      </XStack>
    </XStack>
  );
}

export function ConfirmOnDevice() {
  return (
    // height must be specified on Sheet View.
    <Stack borderRadius="$3" bg="$bgSubdued" height={230}>
      <LottieView
        width="100%"
        height="100%"
        source={require('../../../assets/animations/confirm-on-classic.json')}
      />
    </Stack>
  );
}

export function CommonDeviceLoading({
  children,
  bg,
}: {
  children?: any;
  bg?: IColorTokens;
}) {
  return (
    <Stack
      borderRadius="$3"
      p="$5"
      bg={bg ?? '$bgSubdued'}
      style={{ borderCurve: 'continuous' }}
    >
      <Spinner size="large" />
      {children}
    </Stack>
  );
}

export function EnterPinOnDevice() {
  return (
    // height must be specified on Sheet View.
    <Stack borderRadius="$3" bg="$bgSubdued" height={230}>
      <LottieView
        width="100%"
        height="100%"
        source={require('../../../assets/animations/enter-pin-on-classic.json')}
      />
    </Stack>
  );
}

export function EnterPin({
  onConfirm,
  switchOnDevice,
}: {
  onConfirm: (value: string) => void;
  switchOnDevice: () => void;
}) {
  const [val, setVal] = useState('');
  const varMask = useMemo(
    () =>
      val
        .split('')
        .map((v) => (v ? '•' : ''))
        .join(''),
    [val],
  );
  const keyboardMap = useMemo(
    () => ['7', '8', '9', /**/ '4', '5', '6', /**/ '1', '2', '3'],
    [],
  );
  return (
    <Stack>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$2"
        overflow="hidden"
        style={{
          borderCurve: 'continuous',
        }}
      >
        <XStack
          h="$12"
          alignItems="center"
          px="$3"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          bg="$bgSubdued"
        >
          <SizableText
            selectable={false}
            pl="$6"
            textAlign="center"
            flex={1}
            size="$heading4xl"
          >
            {varMask}
          </SizableText>
          <IconButton
            variant="tertiary"
            icon="XBackspaceOutline"
            onPress={() => {
              setVal((v) => v.slice(0, -1));
            }}
          />
        </XStack>
        <XStack flexWrap="wrap">
          {keyboardMap.map((num, index) => (
            <Stack
              key={index}
              flexBasis="33.3333%"
              h="$14"
              borderRightWidth={StyleSheet.hairlineWidth}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              justifyContent="center"
              alignItems="center"
              {...((index === 2 || index === 5 || index === 8) && {
                borderRightWidth: 0,
              })}
              {...((index === 6 || index === 7 || index === 8) && {
                borderBottomWidth: 0,
              })}
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusStyle={{
                outlineColor: '$focusRing',
                outlineOffset: -2,
                outlineWidth: 2,
                outlineStyle: 'solid',
              }}
              onPress={() => setVal((v) => v + num)}
            >
              <Stack w="$2.5" h="$2.5" borderRadius="$full" bg="$text" />
            </Stack>
          ))}
        </XStack>
      </Stack>
      {/* TODO: add loading state while waiting for result */}
      <Button
        mt="$5"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="primary"
        onPress={() => {
          onConfirm(val);
        }}
      >
        Confirm
      </Button>
      <Button
        m="$0"
        mt="$2"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="tertiary"
        onPress={() => {
          switchOnDevice();
        }}
      >
        Enter on Device
      </Button>
    </Stack>
  );
}

export function EnterPhase({
  onConfirm,
  switchOnDevice,
}: {
  onConfirm: (p: { passphrase: string; save: boolean }) => void;
  switchOnDevice: () => void;
}) {
  const form = useForm<{
    passphrase: string;
    confirmPassphrase: string;
  }>();
  const media = useMedia();
  return (
    <Stack>
      <Stack pb="$5">
        <Alert
          title="Protect Your Passphrase: Irrecoverable if Lost."
          type="warning"
        />
      </Stack>
      <Form form={form}>
        <Form.Field name="passphrase" label="Passphrase">
          <Input
            secureTextEntry
            placeholder="Enter passphrase"
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
        <Form.Field name="confirmPassphrase" label="Confirm Passphrase">
          <Input
            secureTextEntry
            placeholder="Re-enter your passphrase"
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
      </Form>
      {/* TODO: add loading state while waiting for result */}
      <Button
        mt="$5"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="primary"
        onPress={async () => {
          const values = form.getValues();
          if (values.passphrase !== values.confirmPassphrase) {
            Toast.error({
              title: 'passphrase not matched',
            });
            return;
          }
          onConfirm({ passphrase: values.passphrase, save: true });

          // Dialog.show({
          //   icon: 'CheckboxSolid',
          //   title: 'Keep Your Wallet Accessible?',
          //   description:
          //     'Save this wallet to your device to maintain access after the app is closed. Unsaved wallets will be removed automatically.',
          //   onConfirm: () => {
          //     onConfirm({ passphrase: values.passphrase, save: true });
          //   },
          //   onConfirmText: 'Save Wallet',
          //   confirmButtonProps: {
          //     variant: 'secondary',
          //   },
          //   onCancel: () => {
          //     onConfirm({ passphrase: values.passphrase, save: false });
          //   },
          //   onCancelText: "Don't Save",
          // });
        }}
      >
        Confirm
      </Button>
      <Button
        m="$0"
        mt="$2"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="tertiary"
        onPress={switchOnDevice}
      >
        Enter on Device
      </Button>
    </Stack>
  );
}

export function EnterPassphraseOnDevice() {
  return (
    <Stack borderRadius="$3" bg="$bgSubdued" height={230}>
      <LottieView
        width="100%"
        height="100%"
        source={require('../../../assets/animations/enter-passphrase-on-classic.json')}
      />
    </Stack>
  );
}

export function ConfirmPassphrase({
  onConfirm,
  switchOnDevice,
}: {
  onConfirm: () => void;
  switchOnDevice: () => void;
}) {
  return (
    <Stack>
      {/* TODO: switch size to large when media.md */}
      <Input placeholder="Enter your passphrase" />
      {/* TODO: add loading state while waiting for result */}
      <Button
        mt="$5"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="primary"
        onPress={onConfirm}
      >
        Confirm
      </Button>
      <Button
        m="$0"
        mt="$2"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        variant="tertiary"
        onPress={switchOnDevice}
      >
        Enter on Device
      </Button>
    </Stack>
  );
}
