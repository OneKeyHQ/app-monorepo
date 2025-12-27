import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ILottieViewProps, UseFormReturn } from '@onekeyhq/components';
import {
  Alert,
  Anchor,
  Button,
  Dialog,
  ESwitchSize,
  Form,
  Icon,
  IconButton,
  Input,
  LinearGradient,
  LottieView,
  Popover,
  SizableText,
  Stack,
  Switch,
  Toast,
  XStack,
  YStack,
  useForm,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { SHOW_CLOSE_ACTION_MIN_DURATION } from '../../provider/Container/HardwareUiStateContainer/constants';
import { isPassphraseValid } from '../../utils/passphraseUtils';

import CommunicatingLottieView from './CommunicatingLottieView';

import type { IDeviceType } from '@onekeyfe/hd-core';

function MacBluetoothIllustrationViews({
  view,
}: {
  view: 'paring' | 'system-authorized' | 'user-authorized';
}) {
  const themeVariant = useThemeVariant();

  const theme = useTheme();
  const info8Color = theme.info8.val;
  const info10Color = theme.info10.val;
  const paringView = useMemo(() => {
    return (
      <YStack
        animation={[
          'quick',
          {
            opacity: {
              delay: 150,
            },
            y: {
              delay: 150,
            },
            scale: {
              delay: 150,
            },
          },
        ]}
        enterStyle={{
          opacity: 0,
          scale: 0.9,
          y: 8,
        }}
        alignSelf="stretch"
        alignItems="flex-end"
        gap="$3"
        p="$3"
        bg={themeVariant === 'dark' ? '$gray2' : '$bg'}
        borderRadius="$2"
        $platform-web={{
          boxShadow:
            '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        }}
        {...(themeVariant === 'dark' && {
          outlineWidth: 1,
          outlineColor: '$whiteA2',
          outlineStyle: 'solid',
          outlineOffset: 0,
        })}
      >
        <XStack gap="$3" alignSelf="stretch" alignItems="center">
          <LinearGradient
            colors={[info8Color, info10Color]}
            p="$1"
            borderWidth={1}
            borderColor="$info7"
            borderRadius="$2"
            $platform-web={{
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.10)',
            }}
          >
            <Icon name="BluetoothOutline" color="$iconOnColor" />
          </LinearGradient>
          <YStack pt="$1" gap="$1.5">
            <YStack borderRadius={2} bg="$neutral6" h="$1.5" w={145} />
            <XStack gap="$2" alignItems="center">
              <YStack borderRadius={2} bg="$neutral6" h="$1.5" w={35} />
              <XStack
                w={102}
                p={3}
                gap="$1"
                borderRadius={2}
                borderWidth={2}
                borderColor="$borderInfo"
                bg="$bg"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <YStack
                    key={index}
                    borderRadius={2}
                    bg="$neutral11"
                    h="$1.5"
                    w="$1.5"
                  />
                ))}
              </XStack>
            </XStack>
          </YStack>
        </XStack>
        <XStack gap="$2">
          <YStack
            bg={themeVariant === 'dark' ? '$whiteA1' : '$bg'}
            borderRadius="$1"
            w="$12"
            h={15}
            borderWidth={1}
            borderColor="$borderSubdued"
            $platform-web={{
              boxShadow:
                '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
            }}
          />
          <LinearGradient
            colors={[info8Color, info10Color]}
            borderRadius="$1"
            w="$12"
            h={15}
            borderWidth={1}
            borderColor="$info7"
            $platform-web={{
              boxShadow:
                '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
            }}
          />
        </XStack>
      </YStack>
    );
  }, [info10Color, info8Color, themeVariant]);

  const systemAuthorizedView = useMemo(() => {
    return (
      <YStack
        animation={[
          'quick',
          {
            opacity: {
              delay: 150,
            },
            y: {
              delay: 150,
            },
            scale: {
              delay: 150,
            },
          },
        ]}
        enterStyle={{
          opacity: 0,
          scale: 0.9,
          y: 8,
        }}
        alignItems="center"
        gap="$3"
        w={200}
        p="$4"
        bg={themeVariant === 'dark' ? '$gray2' : '$bg'}
        borderRadius="$2"
        $platform-web={{
          boxShadow:
            '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        }}
        {...(themeVariant === 'dark' && {
          outlineWidth: 1,
          outlineColor: '$whiteA2',
          outlineStyle: 'solid',
          outlineOffset: 0,
        })}
      >
        <LinearGradient
          colors={[info8Color, info10Color]}
          p="$1"
          borderWidth={1}
          borderColor="$info7"
          borderRadius="$2"
          $platform-web={{
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.10)',
          }}
        >
          <Icon
            name="HandBack2Solid"
            color="$iconOnColor"
            style={{
              transform: [{ rotateY: '180deg' }],
            }}
          />
        </LinearGradient>
        <YStack gap="$1.5" alignItems="center">
          <YStack borderRadius={2} bg="$neutral6" h="$1.5" w={88} />
          <YStack borderRadius={2} bg="$neutral6" h="$1.5" w={66} />
        </YStack>
        <XStack gap="$2">
          <YStack
            bg={themeVariant === 'dark' ? '$whiteA1' : '$bg'}
            borderRadius="$1"
            w="$12"
            h={15}
            borderWidth={1}
            borderColor="$borderSubdued"
            $platform-web={{
              boxShadow:
                '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
            }}
          />
          <LinearGradient
            colors={[info8Color, info10Color]}
            borderRadius="$1"
            w="$12"
            h={15}
            borderWidth={1}
            borderColor="$info7"
            $platform-web={{
              boxShadow:
                '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
            }}
          />
        </XStack>
      </YStack>
    );
  }, [info10Color, info8Color, themeVariant]);

  const userAuthorizedView = useMemo(() => {
    return <SizableText>user-authorized</SizableText>;
  }, []);

  const getView = useMemo(() => {
    switch (view) {
      case 'paring':
        return paringView;
      case 'system-authorized':
        return systemAuthorizedView;
      case 'user-authorized':
        return userAuthorizedView;
      default:
        return null;
    }
  }, [view, paringView, systemAuthorizedView, userAuthorizedView]);

  return (
    <YStack
      alignItems="center"
      p="$8"
      pb="$6"
      pt="$3"
      bg={themeVariant === 'dark' ? '$bgApp' : '$bgSubdued'}
      borderRadius="$3"
      borderWidth={1}
      borderColor={themeVariant === 'dark' ? '$whiteA2' : '$neutral3'}
      overflow="hidden"
    >
      <YStack
        zIndex={0}
        position="absolute"
        left="$4"
        right="$4"
        bottom={-48}
        h={100}
        bg={themeVariant === 'dark' ? '$whiteA1' : '$bg'}
        borderRadius="$2"
        $platform-web={{
          boxShadow:
            '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        }}
        {...(themeVariant === 'dark' && {
          outlineWidth: 1,
          outlineColor: '$whiteA2',
          outlineStyle: 'solid',
          outlineOffset: 0,
        })}
      />
      {getView}
    </YStack>
  );
}

function WindowsBluetoothIllustrationViews({
  view,
}: {
  view: 'paring' | 'system-authorized' | 'user-authorized';
}) {
  const themeVariant = useThemeVariant();

  // As per design: only two layers inside the illustration area
  // 1) Base container (blank board)
  // 2) Bottom-right pairing toast
  const paringView = useMemo(() => {
    return (
      <YStack
        alignSelf="stretch"
        alignItems="flex-end"
        justifyContent="flex-end"
        pt={12}
        pr={12}
        pb={12}
        pl={32}
        w={360}
        h={144}
        bg={themeVariant === 'dark' ? '#101112' : '#F9F9F9'}
        borderRadius={12}
        borderWidth={1}
        borderColor={
          themeVariant === 'dark'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.055)'
        }
        overflow="visible"
        $platform-web={{
          boxShadow:
            themeVariant === 'dark'
              ? 'inset 0 0 2px rgba(255,255,255,0.08)'
              : 'inset 0 0 2px rgba(0,0,0,0.10)',
        }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.70)', 'rgba(0,0,0,0.80)']}
          start={[0, 0]}
          end={[0, 1]}
          w={117}
          h={48}
          borderRadius={8}
          borderWidth={1}
          borderColor="rgba(0, 0, 0, 0.95)"
          $platform-web={{
            boxShadow:
              '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px rgba(0, 0, 0, 0.10), 0 1px 2px rgba(0, 0, 0, 0.10), inset 0 1px 2px rgba(255, 255, 255, 0.25)',
          }}
          overflow="hidden"
          p={8}
          gap={12}
        >
          <XStack alignItems="center" gap={4} w={101} h={4}>
            <XStack gap={4} alignItems="center" w={85} h={4}>
              <YStack w={4} h={4} bg="rgba(255,255,255,0.5)" borderRadius={1} />
              <YStack
                w={16}
                h={4}
                bg="rgba(255,255,255,0.8)"
                borderRadius={1}
              />
            </XStack>
            <XStack gap={4} alignItems="center" w={12} h={4}>
              <YStack w={4} h={4} bg="rgba(255,255,255,0.5)" borderRadius={1} />
              <YStack w={4} h={4} bg="rgba(255,255,255,0.5)" borderRadius={1} />
            </XStack>
          </XStack>
          <YStack gap={4}>
            <YStack w={24} h={6} bg="rgba(255,255,255,0.95)" borderRadius={2} />
            <YStack w={56} h={6} bg="rgba(255,255,255,0.7)" borderRadius={2} />
          </YStack>
        </LinearGradient>
      </YStack>
    );
  }, [themeVariant]);

  const systemAuthorizedView = useMemo(() => paringView, [paringView]);
  const userAuthorizedView = useMemo(
    () => <SizableText>user-authorized</SizableText>,
    [],
  );

  const getView = useMemo(() => {
    switch (view) {
      case 'paring':
        return paringView;
      case 'system-authorized':
        return systemAuthorizedView;
      case 'user-authorized':
        return userAuthorizedView;
      default:
        return null;
    }
  }, [view, paringView, systemAuthorizedView, userAuthorizedView]);

  // Return only the two-layer illustration as required
  return <>{getView}</>;
}

export interface IConfirmOnDeviceToastContentProps {
  deviceType: IDeviceType;
}

/**
 * Android on React Native 0.79 doesn't support dynamic source switching for LottieView
 * @param source - The source of the LottieView
 * @returns A LottieView component that is compatible with React Native 0.79
 */
function CompatibleLottieView({
  source,
}: {
  source: ILottieViewProps['source'];
}) {
  return source ? (
    <LottieView width="100%" height="100%" source={source} />
  ) : null;
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
      case EDeviceType.Unknown:
        return Promise.resolve(null);
      case EDeviceType.Classic:
      case EDeviceType.Classic1s:
      case EDeviceType.ClassicPure:
        return import(
          '@onekeyhq/kit/assets/animations/confirm-on-classic.json'
        );
      case EDeviceType.Mini:
        return import('@onekeyhq/kit/assets/animations/confirm-on-mini.json');
      case EDeviceType.Touch:
        return import('@onekeyhq/kit/assets/animations/confirm-on-touch.json');
      case EDeviceType.Pro:
        return import(
          '@onekeyhq/kit/assets/animations/confirm-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType = deviceType;
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
      <Stack bg="$bgStrong" btlr="$2" bblr="$2" w={72} h={72}>
        <CompatibleLottieView source={animationData} />
      </Stack>
      <XStack flex={1} alignItems="center" px="$3" gap="$5">
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

export function CommonDeviceLoading({ children }: { children?: any }) {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const { result: communicationMethod } = usePromiseResult<'bluetooth' | 'usb'>(
    async () => {
      if (platformEnv.isNative) {
        return 'bluetooth';
      }
      if (platformEnv.isSupportDesktopBle) {
        if (hardwareTransportType === EHardwareTransportType.DesktopWebBle) {
          return 'bluetooth';
        }
        return 'usb';
      }
      return 'usb';
    },
    [hardwareTransportType],
    {
      initResult: 'usb',
    },
  );
  return (
    <>
      <CommunicatingLottieView method={communicationMethod} />
      {children}
    </>
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
      case EDeviceType.Unknown:
        return Promise.resolve(null);
      case EDeviceType.Classic:
      case EDeviceType.Classic1s:
      case EDeviceType.ClassicPure:
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-classic.json'
        );
      case EDeviceType.Mini:
        return import('@onekeyhq/kit/assets/animations/enter-pin-on-mini.json');
      case EDeviceType.Touch:
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-touch.json'
        );
      case EDeviceType.Pro:
        return import(
          '@onekeyhq/kit/assets/animations/enter-pin-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType = deviceType;
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
      <CompatibleLottieView source={animationData} />
    </Stack>
  );
}

export function EnterPin({
  title,
  onConfirm,
  switchOnDevice,
}: {
  title: string;
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
    () => [
      '7',
      '8',
      '9',
      /**/
      '4',
      '5',
      '6',
      /**/
      '1',
      '2',
      '3',
      /**/
      'delete',
      '0',
      'confirm',
    ],
    [],
  );

  const onDelete = useCallback(() => {
    setVal((v) => v.slice(0, -1));
  }, []);

  const onPress = useCallback(
    (num: string) => {
      if (num === 'delete') {
        onDelete();
        return;
      }
      if (num === 'confirm') {
        onConfirm(val);
        return;
      }
      setVal((v) => {
        // classic only supports 9 digits
        // pro only on device input pin
        if (v.length >= 9) {
          return v;
        }
        return v + num;
      });
    },
    [onConfirm, onDelete, val],
  );

  const getButtonType = useCallback((item: string) => {
    if (item === 'delete') return 'delete';
    if (item === 'confirm') return 'confirm';
    return 'number';
  }, []);

  const buttonStyles = useMemo(
    () => ({
      delete: {
        bg: '$bgSubdued',
        hoverBg: '$bgHover',
        pressBg: '$bgActive',
      },
      confirm: {
        bg: '$bgPrimary',
        hoverBg: '$bgPrimaryHover',
        pressBg: '$bgPrimaryActive',
      },
      number: {
        bg: '$bgSubdued',
        hoverBg: '$bgHover',
        pressBg: '$bgActive',
      },
    }),
    [],
  );

  const getButtonBg = useCallback(
    (item: string, state: 'default' | 'hover' | 'press') => {
      const type = getButtonType(item);
      const style = buttonStyles[type];
      if (state === 'hover') return style.hoverBg;
      if (state === 'press') return style.pressBg;
      return style.bg;
    },
    [buttonStyles, getButtonType],
  );

  const renderKeyboardItem = useCallback((num: string) => {
    if (num === 'delete') {
      return <Icon size="$8" name="XBackspaceOutline" color="$iconStrong" />;
    }
    if (num === 'confirm') {
      return <Icon size="$5" name="CheckLargeOutline" color="$iconInverse" />;
    }
    return <Stack w="$2.5" h="$2.5" borderRadius="$full" bg="$text" />;
  }, []);

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>
          {intl.formatMessage({
            id: ETranslations.enter_pin_desc,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$bgApp"
        borderRadius="$3"
        overflow="hidden"
        borderCurve="continuous"
      >
        <XStack
          h="$12"
          alignItems="center"
          px="$3"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderColor="$bgApp"
          bg="$bgSubdued"
        >
          <SizableText
            userSelect="none"
            textAlign="center"
            flex={1}
            size="$heading4xl"
          >
            {varMask}
          </SizableText>
        </XStack>
        <XStack flexWrap="wrap">
          {keyboardMap.map((num, index) => {
            const isLastColumn = (index + 1) % 3 === 0;
            const isLastRow = index >= 9;
            return (
              <Stack
                key={index}
                flexBasis="33.3333%"
                h="$14"
                borderRightWidth={isLastColumn ? 0 : StyleSheet.hairlineWidth}
                borderBottomWidth={isLastRow ? 0 : StyleSheet.hairlineWidth}
                borderColor="$bgApp"
                justifyContent="center"
                alignItems="center"
                bg={getButtonBg(num, 'default')}
                hoverStyle={{
                  bg: getButtonBg(num, 'hover'),
                }}
                pressStyle={{
                  bg: getButtonBg(num, 'press'),
                }}
                focusable
                focusVisibleStyle={{
                  outlineColor: '$focusRing',
                  outlineOffset: -2,
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                }}
                onPress={() => onPress(num)}
              >
                {renderKeyboardItem(num)}
              </Stack>
            );
          })}
        </XStack>
      </Stack>
      {/* TODO: add loading state while waiting for result */}
      <Button
        m="$0"
        mt="$2.5"
        $md={
          {
            size: 'medium',
          } as any
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

interface IEnterPhaseFormValues {
  passphrase: string;
  confirmPassphrase: string;
  hideImmediately: boolean;
}

export function EnterPhase({
  isVerifyMode,
  allowUseAttachPin,
  onConfirm,
  switchOnDevice,
  switchOnDeviceAttachPin,
}: {
  isVerifyMode?: boolean;
  allowUseAttachPin?: boolean;
  onConfirm: (p: {
    passphrase: string;
    save: boolean;
    hideImmediately: boolean;
  }) => void;
  switchOnDevice: ({ hideImmediately }: { hideImmediately: boolean }) => void;
  switchOnDeviceAttachPin: ({
    hideImmediately,
  }: {
    hideImmediately: boolean;
  }) => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const formOption = useMemo(
    () => ({
      defaultValues: {
        passphrase: '',
        confirmPassphrase: '',
        hideImmediately:
          settings.hiddenWalletImmediately === undefined
            ? true
            : settings.hiddenWalletImmediately,
      },
      onSubmit: async (form: UseFormReturn<IEnterPhaseFormValues>) => {
        const values = form.getValues();
        const passphrase = values.passphrase || '';
        onConfirm({
          passphrase,
          save: true,
          hideImmediately: values.hideImmediately,
        });
      },
    }),
    [onConfirm, settings.hiddenWalletImmediately],
  );
  const form = useForm<IEnterPhaseFormValues>(formOption);

  const handleSwitchOnDevice = useCallback(() => {
    switchOnDevice({ hideImmediately: form.getValues().hideImmediately });
  }, [form, switchOnDevice]);

  const handleSwitchOnDeviceAttachPin = useCallback(() => {
    switchOnDeviceAttachPin({
      hideImmediately: form.getValues().hideImmediately,
    });
  }, [form, switchOnDeviceAttachPin]);

  const media = useMedia();
  const [secureEntry1, setSecureEntry1] = useState(true);

  // Watch passphrase input to control button state
  const passphraseValue = form.watch('passphrase');
  const isButtonDisabled = isVerifyMode
    ? false
    : !passphraseValue || passphraseValue === '';

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
          description={
            <XStack gap="$1" pt="$2">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.passphrase_character_limit,
                })}
              </SizableText>
              <Popover
                placement="bottom"
                floatingPanelProps={{
                  width: '$80',
                }}
                title={intl.formatMessage({
                  id: ETranslations.passphrase_allowed_characters_title,
                })}
                renderTrigger={
                  <IconButton
                    variant="tertiary"
                    size="small"
                    icon="InfoCircleOutline"
                  />
                }
                renderContent={() => (
                  <Stack
                    p="$5"
                    $md={{
                      pt: '$0',
                    }}
                  >
                    <Anchor
                      href="https://www.ascii-code.com/"
                      size="$bodyMd"
                      color="$textInfo"
                    >
                      {intl.formatMessage({
                        id: ETranslations.passphrase_allowed_characters_desc,
                      })}
                    </Anchor>
                  </Stack>
                )}
              />
            </XStack>
          }
          labelAddon={
            <Button
              variant="tertiary"
              size="small"
              icon="OnekeyDeviceCustom"
              onPress={handleSwitchOnDevice}
            >
              {intl.formatMessage({
                id: ETranslations.global_enter_on_device,
              })}
            </Button>
          }
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
            secureTextEntry={secureEntry1}
            placeholder={intl.formatMessage({
              id: ETranslations.global_enter_passphrase,
            })}
            addOns={[
              {
                iconName: secureEntry1 ? 'EyeOutline' : 'EyeOffOutline',
                onPress: () => {
                  setSecureEntry1(!secureEntry1);
                },
              },
            ]}
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
        {!isVerifyMode ? (
          <Form.Field
            horizontal
            name="hideImmediately"
            description={
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.hidden_wallet_accessibility_title,
                  },
                  {
                    strong: (chunks: ReactNode[]) => (
                      <SizableText size="$bodyMdMedium" color="$text">
                        {chunks}
                      </SizableText>
                    ),
                  },
                )}
              </SizableText>
            }
          >
            <Switch size={ESwitchSize.small} />
          </Form.Field>
        ) : null}
      </Form>
      {/* TODO: add loading state while waiting for result */}
      <Button
        mt="$5"
        $md={
          {
            size: 'large',
          } as any
        }
        variant="primary"
        disabled={isButtonDisabled}
        onPress={form.submit}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
      {allowUseAttachPin ? (
        <Button
          m="$0"
          mt="$2.5"
          $md={
            {
              size: 'large',
            } as any
          }
          variant="secondary"
          onPress={handleSwitchOnDeviceAttachPin}
        >
          {intl.formatMessage({
            id: ETranslations.global_enter_hidden_wallet_pin,
          })}
        </Button>
      ) : null}
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
      case EDeviceType.Unknown:
        return Promise.resolve(null);
      case EDeviceType.Classic:
      case EDeviceType.Classic1s:
      case EDeviceType.ClassicPure:
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-classic.json'
        );
      case EDeviceType.Mini:
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-mini.json'
        );
      case EDeviceType.Touch:
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-touch.json'
        );
      case EDeviceType.Pro:
        return import(
          '@onekeyhq/kit/assets/animations/enter-passphrase-on-pro-dark.json'
        );
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
        const checkType = deviceType;
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
      <CompatibleLottieView source={animationData} />
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
          } as any
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
          } as any
        }
        variant="tertiary"
        onPress={switchOnDevice}
      >
        {intl.formatMessage({ id: ETranslations.global_enter_on_device })}
      </Button>
    </Stack>
  );
}

export interface IDesktopBluetoothPermissionContentProps {
  promiseId?: string;
}

export function DesktopBluetoothPermissionContent({
  promiseId,
}: IDesktopBluetoothPermissionContentProps) {
  const intl = useIntl();
  const retryCount = useRef(0);

  useEffect(() => {
    if (!promiseId) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const callbackResult = async (result: boolean) => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      // Set isRequestedPermission to true after user grants permission
      await backgroundApiProxy.serviceSetting.setDesktopBluetoothAtom({
        isRequestedPermission: true,
      });
      void backgroundApiProxy.servicePromise.resolveCallback({
        id: promiseId,
        data: result,
      });
    };

    const checkBluetoothStatus = async () => {
      retryCount.current += 1;
      if (retryCount.current > 10) {
        void callbackResult(false);
        return;
      }
      try {
        const available =
          await globalThis?.desktopApi?.nobleBle?.checkAvailability();
        console.log(
          'HardwareUiStateContent checkBluetoothStatus available -> :',
          available,
        );
        if (available?.available) {
          void callbackResult(true);
        }
      } catch (error) {
        console.error('Check bluetooth status error:', error);
      }
    };

    pollTimer = setInterval(checkBluetoothStatus, 1000);

    return () => {
      clearInterval(pollTimer);
    };
  }, [promiseId]);

  return (
    <YStack gap="$5">
      {platformEnv.isDesktopWin ? (
        <WindowsBluetoothIllustrationViews view="system-authorized" />
      ) : (
        <MacBluetoothIllustrationViews view="system-authorized" />
      )}
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: ETranslations.communication_not_detected_bluetooth_fallback,
        })}
      </SizableText>
    </YStack>
  );
}

interface IBluetoothDevicePairingContentProps {
  deviceId?: string;
  usbConnectId?: string;
  features?: any;
  promiseId?: string;
}

export function BluetoothDevicePairingContent({
  deviceId,
  usbConnectId,
  features,
  promiseId,
}: IBluetoothDevicePairingContentProps) {
  const intl = useIntl();
  const isProcessingRef = useRef(false);

  // execute pairing process silently in background
  const executePairingProcess = useCallback(async () => {
    if (isProcessingRef.current || !deviceId || !usbConnectId || !promiseId)
      return;

    isProcessingRef.current = true;

    try {
      const result =
        await backgroundApiProxy.serviceHardware.repairBleConnectIdWithProgress(
          {
            connectId: usbConnectId,
            featuresDeviceId: deviceId,
            features,
          },
        );
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: usbConnectId,
        reason: 'Bluetooth pairing success',
      });
      await backgroundApiProxy.servicePromise.resolveCallback({
        id: promiseId,
        data: result,
      });
    } catch (error) {
      console.error('Bluetooth device pairing failed:', error);
      await backgroundApiProxy.servicePromise.rejectCallback({
        id: promiseId,
        error: error as Error,
      });
      // Close the dialog after reject
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: usbConnectId,
        reason: 'Bluetooth pairing failed',
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [deviceId, usbConnectId, features, promiseId]);

  useEffect(() => {
    void executePairingProcess();
  }, [executePairingProcess]);

  return (
    <YStack gap="$5">
      {platformEnv.isDesktopWin ? (
        <WindowsBluetoothIllustrationViews view="paring" />
      ) : (
        <MacBluetoothIllustrationViews view="paring" />
      )}
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: ETranslations.communication_not_detected_bluetooth_not_paired,
        })}
      </SizableText>
      <YStack gap="$2">
        <XStack gap="$2" alignItems="flex-start">
          <YStack w="$5" alignItems="center" justifyContent="center">
            <SizableText color="$textDisabled">1.</SizableText>
          </YStack>
          <SizableText>
            {intl.formatMessage({
              id: platformEnv.isDesktopWin
                ? ETranslations.bluetooth_paring_guides_unlock_win
                : ETranslations.bluetooth_paring_guides_unlock,
            })}
          </SizableText>
        </XStack>
        <XStack gap="$2" alignItems="flex-start">
          <YStack w="$5" alignItems="center" justifyContent="center">
            <SizableText color="$textDisabled">2.</SizableText>
          </YStack>
          <SizableText>
            {intl.formatMessage({
              id: platformEnv.isDesktopWin
                ? ETranslations.bluetooth_paring_guides_pair_win
                : ETranslations.bluetooth_paring_guides_pair,
            })}
          </SizableText>
        </XStack>
        <XStack gap="$2" alignItems="flex-start">
          <YStack w="$5" alignItems="center" justifyContent="center">
            <SizableText color="$textDisabled">3.</SizableText>
          </YStack>
          <SizableText>
            {intl.formatMessage({
              id: platformEnv.isDesktopWin
                ? ETranslations.bluetooth_paring_guides_wait_for_confirmation_win
                : ETranslations.bluetooth_paring_guides_wait_for_confirmation,
            })}
          </SizableText>
        </XStack>
      </YStack>
    </YStack>
  );
}

export function BluetoothPermissionUnauthorizedContent() {
  const intl = useIntl();
  const handleGoToSettings = useCallback(() => {
    void globalThis.desktopApiProxy.bluetooth.openPrivacySettings();
  }, []);

  return (
    <YStack gap="$5">
      <CommunicatingLottieView method="usb" />
      <YStack gap="$2.5">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.communication_not_detected_bluetooth_no_permission,
          })}
        </SizableText>
        <Button
          size="small"
          variant="secondary"
          alignSelf="stretch"
          onPress={handleGoToSettings}
        >
          {intl.formatMessage({
            id: ETranslations.global_go_to_settings,
          })}
        </Button>
        <SizableText size="$bodySm" color="$textDisabled">
          {intl.formatMessage({
            id: ETranslations.bluetooth_disable_in_settings,
          })}
        </SizableText>
      </YStack>
    </YStack>
  );
}
