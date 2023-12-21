import { useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { useMedia } from 'tamagui';

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
  useDialogInstance,
} from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

export function ConfirmOnClassic() {
  return (
    <XStack alignItems="center" mb="$-2.5" mt="$2.5" ml="$-2.5">
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
          width={64}
          height={64}
          source={require('../../../assets/animations/confirm-on-classic.json')}
        />
      </Stack>
      <SizableText size="$bodyLgMedium" textAlign="center" pl="$4">
        Confirm on Device
      </SizableText>
    </XStack>
  );
}

export function EnterPin() {
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
          <SizableText pl="$6" textAlign="center" flex={1} size="$heading4xl">
            ••••••
          </SizableText>
          <IconButton variant="tertiary" icon="XBackspaceOutline" />
        </XStack>
        <XStack flexWrap="wrap">
          {Array.from({ length: 9 }).map((_, index) => (
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
        onPress={() =>
          Toast.error({
            title: 'Wrong PIN',
          })
        }
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
      >
        Enter on Device
      </Button>
    </Stack>
  );
}

export function EnterPinOnDevice() {
  return (
    <Stack borderRadius="$3" bg="$bgSubdued">
      <LottieView
        source={require('../../../assets/animations/enter-pin-on-classic.json')}
      />
    </Stack>
  );
}

export function EnterPhase() {
  const form = useForm();
  const media = useMedia();
  const dialog = useDialogInstance();
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
            placeholder="Enter passphrase"
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
        <Form.Field name="confirmPassphrase" label="Confirm Passphrase">
          <Input
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
          await dialog.close();
          Dialog.show({
            icon: 'CheckboxSolid',
            title: 'Keep Your Wallet Accessible?',
            description:
              'Save this wallet to your device to maintain access after the app is closed. Unsaved wallets will be removed automatically.',
            onConfirm: () => console.log('confirmed'),
            onConfirmText: 'Save Wallet',
            confirmButtonProps: {
              variant: 'secondary',
            },
            onCancel: () => console.log('canceled'),
            onCancelText: "Don't Save",
          });
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
      >
        Enter on Device
      </Button>
    </Stack>
  );
}

export function EnterPassphraseOnDevice() {
  return (
    <Stack borderRadius="$3" bg="$bgSubdued">
      <LottieView
        source={require('../../../assets/animations/enter-passphrase-on-classic.json')}
      />
    </Stack>
  );
}

export function ConfirmPassphrase() {
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
      >
        Enter on Device
      </Button>
    </Stack>
  );
}
