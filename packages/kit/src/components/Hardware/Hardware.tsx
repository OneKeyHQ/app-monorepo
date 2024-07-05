import { useCallback, useEffect, useMemo, useState } from 'react';

import { useForm } from 'react-hook-form';
import { useIntl } from 'react-intl';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SHOW_CLOSE_ACTION_MIN_DURATION } from '../../provider/Container/HardwareUiStateContainer/constants';
import { isPassphraseValid } from '../../utils/passphraseUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

export interface IConfirmOnDeviceToastContentProps {
  deviceType: IDeviceType;
}

export function ConfirmOnDeviceToastContent({
  deviceType,
}: IConfirmOnDeviceToastContentProps) {
  const intl = useIntl();
  const [animationData, setAnimationData] = useState<any>(null);
  const [showErrorButton, setShowErrorButton] = useState(false);

  const requireResource = useCallback(() => {
    switch (deviceType) {
      // Prevents the device type from being obtained
      case null:
      case undefined:
        return Promise.resolve(null);
      // Specify unsupported devices
      case 'unknown':
        return Promise.resolve(null);
      case 'classic':
      case 'classic1s':
        return import(
          '@onekeyhq/kit/assets/animations/confirm-on-classic.json'
        );
      case 'mini':
        return import('@onekeyhq/kit/assets/animations/confirm-on-mini.json');
      case 'touch':
        return import('@onekeyhq/kit/assets/animations/confirm-on-touch.json');
      case 'pro':
        return import(
          '@onekeyhq/kit/assets/animations/confirm-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType: never = deviceType;
    }
  }, [deviceType]);

  useEffect(() => {
    requireResource()
      ?.then((module) => {
        setAnimationData(module?.default);
      })
      ?.catch(() => {
        // ignore
      });
  }, [requireResource]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowErrorButton(true);
    }, SHOW_CLOSE_ACTION_MIN_DURATION);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <XStack alignItems="center">
      <Stack bg="$bgStrong" btlr="$2" bblr="$2">
        <LottieView width={72} height={72} source={animationData ?? ''} />
      </Stack>
      <XStack flex={1} alignItems="center" px="$3" space="$5">
        <SizableText flex={1} size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.global_confirm_on_device })}
        </SizableText>
        <Stack minWidth="$8">
          {showErrorButton ? (
            <Toast.Close>
              <IconButton size="small" icon="CrossedSmallOutline" />
            </Toast.Close>
          ) : null}
        </Stack>
      </XStack>
    </XStack>
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
      borderCurve="continuous"
    >
      <Spinner size="large" />
      {children}
    </Stack>
  );
}

export function EnterPinOnDevice({
  deviceType,
}: {
  deviceType: IDeviceType | undefined;
}) {
  const requireResource = useCallback(() => {
    switch (deviceType) {
      // Prevents the device type from being obtained
      case null:
      case undefined:
        return Promise.resolve(null);
      // Specify unsupported devices
      case 'unknown':
        return Promise.resolve(null);
      case 'classic':
      case 'classic1s':
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-classic.json'
        );
      case 'mini':
        return import('@onekeyhq/kit/assets/animations/enter-pin-on-mini.json');
      case 'touch':
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-touch.json'
        );
      case 'pro':
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType: never = deviceType;
    }
  }, [deviceType]);

  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    requireResource()
      ?.then((module) => {
        setAnimationData(module?.default);
      })
      ?.catch(() => {
        // ignore
      });
  }, [requireResource]);

  return (
    // height must be specified on Sheet View.
    <Stack borderRadius="$3" bg="$bgSubdued" height={230}>
      {animationData ? (
        <LottieView width="100%" height="100%" source={animationData} />
      ) : null}
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
  const intl = useIntl();
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
        borderCurve="continuous"
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
        {intl.formatMessage({ id: ETranslations.global_confirm })}
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
        {intl.formatMessage({ id: ETranslations.global_enter_on_device })}
      </Button>
    </Stack>
  );
}

export function EnterPhase({
  isSingleInput,
  onConfirm,
  switchOnDevice,
}: {
  isSingleInput?: boolean;
  onConfirm: (p: { passphrase: string; save: boolean }) => void;
  switchOnDevice: () => void;
}) {
  const form = useForm<{
    passphrase: string;
    confirmPassphrase: string;
  }>();
  const media = useMedia();
  const intl = useIntl();

  return (
    <Stack>
      <Stack pb="$5">
        <Alert
          title={intl.formatMessage({
            id: ETranslations.global_enter_passphrase_alert,
          })}
          type="warning"
        />
      </Stack>
      <Form form={form}>
        <Form.Field
          name="passphrase"
          label={intl.formatMessage({ id: ETranslations.global_passphrase })}
          rules={{
            maxLength: {
              value: 50,
              message: intl.formatMessage(
                {
                  id: ETranslations.hardware_passphrase_enter_too_long,
                },
                {
                  0: 50,
                },
              ),
            },
            validate: (text) => {
              const valid = isPassphraseValid(text);
              if (valid) {
                return undefined;
              }
              return intl.formatMessage({
                id: ETranslations.hardware_unsupported_passphrase_characters,
              });
            },
            onChange: () => {
              form.clearErrors();
            },
          }}
        >
          <Input
            secureTextEntry
            placeholder={intl.formatMessage({
              id: ETranslations.global_enter_passphrase,
            })}
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
        {!isSingleInput ? (
          <Form.Field
            name="confirmPassphrase"
            label={intl.formatMessage({
              id: ETranslations.form_confirm_passphrase,
            })}
          >
            <Input
              secureTextEntry
              placeholder={intl.formatMessage({
                id: ETranslations.form_confirm_passphrase_placeholder,
              })}
              {...(media.md && {
                size: 'large',
              })}
            />
          </Form.Field>
        ) : null}
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
        onPress={form.handleSubmit(async () => {
          const values = form.getValues();
          if (
            !isSingleInput &&
            values.passphrase !== values.confirmPassphrase
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.feedback_passphrase_not_matched,
              }),
            });
            return;
          }
          // allow empty passphrase
          const passphrase = values.passphrase || '';
          onConfirm({ passphrase, save: true });

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
        })}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
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
        {intl.formatMessage({ id: ETranslations.global_enter_on_device })}
      </Button>
    </Stack>
  );
}

export function EnterPassphraseOnDevice({
  deviceType,
}: {
  deviceType: IDeviceType | undefined;
}) {
  const requireResource = useCallback(() => {
    switch (deviceType) {
      // Prevents the device type from being obtained
      case null:
      case undefined:
        return Promise.resolve(null);
      // Specify unsupported devices
      case 'unknown':
        return Promise.resolve(null);
      case 'classic':
      case 'classic1s':
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-classic.json'
        );
      case 'mini':
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-mini.json'
        );
      case 'touch':
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-touch.json'
        );
      case 'pro':
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType: never = deviceType;
    }
  }, [deviceType]);

  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    requireResource()
      ?.then((module) => {
        setAnimationData(module?.default);
      })
      ?.catch(() => {
        // ignore
      });
  }, [requireResource]);

  return (
    <Stack borderRadius="$3" bg="$bgSubdued" height={230}>
      {animationData ? (
        <LottieView width="100%" height="100%" source={animationData} />
      ) : null}
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
  const intl = useIntl();

  return (
    <Stack>
      <Input
        size="large"
        $gtMd={{
          size: 'medium',
        }}
        placeholder={intl.formatMessage({
          id: ETranslations.global_enter_passphrase,
        })}
      />
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
        {intl.formatMessage({ id: ETranslations.global_confirm })}
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
        {intl.formatMessage({ id: ETranslations.global_enter_on_device })}
      </Button>
    </Stack>
  );
}
