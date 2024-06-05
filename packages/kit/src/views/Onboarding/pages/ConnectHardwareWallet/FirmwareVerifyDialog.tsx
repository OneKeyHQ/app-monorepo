import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { Linking, StyleSheet } from 'react-native';

import type {
  IButtonProps,
  ISizableTextProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  Button,
  Dialog,
  HeightTransition,
  Icon,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IFirmwareAuthenticationState =
  | 'unknown'
  | 'official'
  | 'unofficial'
  | 'error';

type IFirmwareErrorState = 'UnexpectedBootloaderMode' | undefined;

function useFirmwareVerifyBase({
  device,
  skipDeviceCancel,
}: {
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
}) {
  const [result, setResult] = useState<IFirmwareAuthenticationState>('unknown'); // unknown, official, unofficial, error
  const [errorState, setErrorState] = useState<IFirmwareErrorState>();

  const verify = useCallback(async () => {
    try {
      setErrorState(undefined);
      const authResult =
        await backgroundApiProxy.serviceHardware.firmwareAuthenticate({
          device,
          skipDeviceCancel,
        });
      console.log('firmwareAuthenticate >>>> ', authResult);
      if (authResult.verified) {
        setResult('official');
        // setResult('unofficial');
      } else {
        setResult('unofficial');
      }
    } catch (error) {
      setResult('error');
      if (
        (error as OneKeyError).code ===
        HardwareErrorCode.DeviceUnexpectedBootloaderMode
      ) {
        setErrorState('UnexpectedBootloaderMode');
      }
      throw error;
    } finally {
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId || '',
        skipDeviceCancel,
      });
    }
  }, [device, skipDeviceCancel]);

  useEffect(() => {
    void verify();
    // setTimeout(() => {
    //   setIsConfirmOnDevice(true);
    //   setTimeout(() => {
    //     setResult('official');
    //   }, 3000);
    // }, 3000);
  }, [verify]);

  const reset = useCallback(() => {
    setResult('unknown');
    setErrorState(undefined);
  }, []);

  return { result, reset, errorState, verify };
}

export function FirmwareAuthenticationDialogContentLegacy({
  onContinue,
  device,
  skipDeviceCancel,
}: {
  onContinue: (params: { checked: boolean }) => void;
  device: SearchDevice;
  skipDeviceCancel?: boolean;
}) {
  const { result, reset, verify } = useFirmwareVerifyBase({
    device,
    skipDeviceCancel,
  });
  const requestsUrl = useHelpLink({ path: 'requests/new' });

  return (
    <Stack>
      <HeightTransition initialHeight={106}>
        <Stack
          borderRadius="$3"
          p="$5"
          bg="$bgSubdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$transparent"
          {...(result === 'official' && {
            bg: '$bgSuccessSubdued',
            borderColor: '$borderSuccessSubdued',
          })}
          {...(result === 'unofficial' && {
            bg: '$bgCriticalSubdued',
            borderColor: '$borderCriticalSubdued',
          })}
          {...(result === 'error' && {
            bg: '$bgCautionSubdued',
            borderColor: '$borderCautionSubdued',
          })}
          borderCurve="continuous"
        >
          <Stack>
            <Stack justifyContent="center" alignItems="center">
              {result === 'unknown' ? (
                <Spinner size="large" />
              ) : (
                <Icon
                  name="BadgeVerifiedSolid"
                  size="$9"
                  color="$iconSuccess"
                  {...(result === 'unofficial' && {
                    name: 'ErrorSolid',
                    color: '$iconCritical',
                  })}
                  {...(result === 'error' && {
                    name: 'ErrorSolid',
                    color: '$iconCaution',
                  })}
                />
              )}
            </Stack>

            <SizableText
              textAlign="center"
              mt="$5"
              {...(result === 'official' && {
                color: '$textSuccess',
              })}
              {...(result === 'unofficial' && {
                color: '$textCritical',
              })}
              {...(result === 'error' && {
                color: '$textCaution',
              })}
            >
              {result === 'unknown' ? 'Verifying official firmware' : null}
              {result === 'official'
                ? 'Your device is running official firmware'
                : null}
              {result === 'unofficial' ? 'Unofficial firmware detected!' : null}
              {result === 'error'
                ? 'Unable to verify firmware: internet connection required'
                : null}
            </SizableText>
          </Stack>
        </Stack>
        {result !== 'unknown' ? (
          <Stack pt="$5">
            <Button
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
              variant="primary"
              {...(result === 'official' && {
                onPress: () => onContinue({ checked: true }),
              })}
              {...(result === 'unofficial' && {
                onPress: async () => {
                  // Contact OneKey Support
                  await Linking.openURL(requestsUrl);
                },
              })}
              {...(result === 'error' && {
                onPress: async () => {
                  reset();
                  // Retry
                  await verify();
                },
              })}
            >
              {result === 'official' ? 'Continue' : null}
              {result === 'unofficial' ? 'Contact OneKey Support' : null}
              {result === 'error' ? 'Retry' : null}
            </Button>
          </Stack>
        ) : null}
        {result === 'error' ? (
          <Stack pt="$3">
            <Button
              variant="tertiary"
              m="$0"
              onPress={() => onContinue({ checked: false })}
            >
              Continue Anyway(Legacy)
            </Button>
          </Stack>
        ) : null}
      </HeightTransition>
    </Stack>
  );
}

function BasicDialogContentContainer({ children, ...props }: IStackProps) {
  return (
    <Stack
      p="$5"
      space="$5"
      borderRadius="$3"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      {...props}
    >
      {children}
    </Stack>
  );
}

export function BasicFirmwareAuthenticationDialogContent({
  showLoading,
  showActions,
  actionsProps,
  showContinue,
  continueProps,
  showRiskyWarning,
  textContent,
  textContentContainerProps,
  riskyWarningProps,
}: {
  textContentContainerProps?: IStackProps;
  textContent?: string;
  showLoading: boolean;
  showActions: boolean;
  actionsProps: IButtonProps;
  showContinue: boolean;
  continueProps?: IButtonProps;
  showRiskyWarning: boolean;
  riskyWarningProps: {
    buttonProps: IButtonProps;
    message: string;
  };
}) {
  const content = useMemo(() => {
    if (showLoading) {
      return <Spinner />;
    }
    return (
      <>
        {textContent ? (
          <BasicDialogContentContainer {...textContentContainerProps}>
            <SizableText textAlign="center">{textContent}</SizableText>
          </BasicDialogContentContainer>
        ) : null}

        {showActions ? (
          <Button
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            variant="primary"
            {...actionsProps}
          />
        ) : null}

        {showContinue ? (
          <Button
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            {...continueProps}
          />
        ) : null}
        {showRiskyWarning ? (
          <YStack p="$5" space="$5" bg="$bgCautionSubdued">
            <SizableText size="$bodyLgMedium" color="$textCaution">
              {riskyWarningProps.message}
            </SizableText>
            <Button
              bg="transparent"
              borderColor="$bgStrong"
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
              {...riskyWarningProps.buttonProps}
            />
          </YStack>
        ) : null}
      </>
    );
  }, [
    actionsProps,
    continueProps,
    riskyWarningProps.buttonProps,
    riskyWarningProps.message,
    showActions,
    showContinue,
    showLoading,
    showRiskyWarning,
    textContent,
    textContentContainerProps,
  ]);
  return <YStack space="$5">{content} </YStack>;
}

export function FirmwareAuthenticationDialogContent({
  onContinue,
  device,
  skipDeviceCancel,
  noContinue,
}: {
  onContinue: (params: { checked: boolean }) => void;
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
  noContinue?: boolean;
}) {
  const [isShowingRiskWarning, setIsShowingRiskWarning] = useState(true);

  const { result, reset, errorState, verify } = useFirmwareVerifyBase({
    device,
    skipDeviceCancel,
  });

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const textContent = useMemo(() => {
    if (result === 'official') {
      return 'Your device is running official firmware';
    }

    if (result === 'unofficial') {
      return 'Unofficial firmware detected!';
    }

    return '';
  }, [result]);

  const content = useMemo(() => {
    if (result === 'unknown') {
      return (
        <Stack
          p="$5"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <Spinner size="large" />
        </Stack>
      );
    }
    const propsMap: Record<
      IFirmwareAuthenticationState,
      {
        onPress: () => void;
        button: string;
        textStackProps?: IStackProps;
      }
    > = {
      unknown: {
        onPress: () => {},
        button: 'Loading',
      },
      official: {
        onPress: () => onContinue({ checked: true }),
        button: 'Continue',
        textStackProps: {
          bg: '$bgSuccessSubdued',
          borderColor: '$borderSuccessSubdued',
        },
      },
      unofficial: {
        onPress: async () => {
          await Linking.openURL(requestsUrl);
        },
        button: 'Contact us',
        textStackProps: {
          bg: '$bgCriticalSubdued',
          borderColor: '$borderCriticalSubdued',
        },
      },
      error: {
        onPress: async () => {
          reset();
          setIsShowingRiskWarning(true);
          await verify();
        },
        button: 'Retry',
        textStackProps: {
          bg: '$bgCautionSubdued',
          borderColor: '$borderCautionSubdued',
        },
      },
    };

    const showContinue = !(
      result === 'error' && errorState === 'UnexpectedBootloaderMode'
    );
    const continueProps = showContinue
      ? ({
          key: 'continue-anyway',
          variant: 'tertiary',
          children: 'Continue Anyway',
          onPress: () => onContinue({ checked: false }),
        } as IButtonProps)
      : undefined;

    const riskyWarningProps = {
      message:
        result === 'error' && errorState === 'UnexpectedBootloaderMode'
          ? 'Device is in unexpected bootloader mode.'
          : `We're currently unable to verify your device. Continuing may pose
  security risks.`,
      buttonProps: {
        onPress: () =>
          noContinue
            ? onContinue({ checked: false })
            : setIsShowingRiskWarning(false),
        children: 'I Understand',
      },
    };

    return (
      <BasicFirmwareAuthenticationDialogContent
        showLoading={false}
        textContentContainerProps={propsMap[result].textStackProps}
        textContent={textContent}
        showActions={!(result === 'official' && noContinue)}
        actionsProps={{
          onPress: propsMap[result].onPress,
          children: propsMap[result].button,
        }}
        showContinue={showContinue}
        continueProps={continueProps}
        showRiskyWarning={isShowingRiskWarning}
        riskyWarningProps={riskyWarningProps}
      />
    );
  }, [
    result,
    errorState,
    textContent,
    noContinue,
    isShowingRiskWarning,
    onContinue,
    requestsUrl,
    reset,
    verify,
  ]);

  return <Stack space="$5">{content}</Stack>;
}

export function useFirmwareVerifyDialog({
  noContinue,
}: {
  noContinue?: boolean;
} = {}) {
  const showFirmwareVerifyDialog = useCallback(
    async ({
      device,
      onContinue,
    }: {
      device: SearchDevice | IDBDevice;
      onContinue: (params: { checked: boolean }) => Promise<void> | void;
    }) => {
      const firmwareAuthenticationDialog = Dialog.show({
        tone: 'success',
        icon: 'DocumentSearch2Outline',
        // title: 'Firmware Authentication',
        title: 'Device Authentication',
        description:
          'Confirm on your device to verify its authenticity and secure your connection.',
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <FirmwareAuthenticationDialogContent
            device={device}
            noContinue={noContinue}
            onContinue={async ({ checked }) => {
              await firmwareAuthenticationDialog.close();
              await onContinue({ checked });
            }}
            {...{
              skipDeviceCancel: true, // FirmwareAuthenticationDialogContent
            }}
          />
        ),
        async onClose() {
          if (device.connectId) {
            await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
              {
                connectId: device.connectId,
                skipDeviceCancel: true, // FirmwareAuthenticationDialogContent onClose
              },
            );
          }
        },
      });
    },
    [noContinue],
  );
  return {
    showFirmwareVerifyDialog,
  };
}
