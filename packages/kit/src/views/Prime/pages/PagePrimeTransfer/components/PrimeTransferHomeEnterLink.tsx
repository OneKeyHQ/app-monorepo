import { useCallback, useEffect, useRef, useState } from 'react';

import pTimeout from 'p-timeout';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Form,
  Input,
  Skeleton,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import type { IInputAddOnProps } from '@onekeyhq/components/src/forms/Input/InputAddOnItem';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

interface IPrimeTransferForm {
  pairingCode: string;
}

export function PrimeTransferHomeEnterLink({
  remotePairingCode,
  setRemotePairingCode,
}: {
  remotePairingCode: string;
  setRemotePairingCode: (code: string) => void;
}) {
  // Initialize form
  const form = useForm<IPrimeTransferForm>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { pairingCode: remotePairingCode || '' },
  });

  const { gtSm } = useMedia();

  // Watch form value and sync with existing state
  const watchedPairingCode = form.watch('pairingCode');

  useEffect(() => {
    if (watchedPairingCode !== remotePairingCode) {
      setRemotePairingCode(watchedPairingCode);
    }
  }, [watchedPairingCode, remotePairingCode, setRemotePairingCode]);

  const [primeTransferAtom] = usePrimeTransferAtom();
  const websocketConnected = primeTransferAtom.websocketConnected;
  // const websocketConnected = false;

  const intl = useIntl();
  const navigation = useAppNavigation();

  const { start } = useScanQrCode();
  const { onPasteClearText, clearText, getClipboard, supportPaste } =
    useClipboard();
  const [isConnecting, setIsConnecting] = useState(false);
  const isConnectingRef = useRef(isConnecting);
  isConnectingRef.current = isConnecting;

  const connectRemoteDeviceFn = useCallback(async (pairingCode: string) => {
    // Validation is now handled by Form validate rules
    // Get room ID for connection
    const remoteRoomId =
      await backgroundApiProxy.servicePrimeTransfer.getRoomIdFromPairingCode(
        pairingCode,
      );

    await backgroundApiProxy.servicePrimeTransfer.joinRoom({
      roomId: remoteRoomId,
    });
    await backgroundApiProxy.servicePrimeTransfer.verifyPairingCode({
      pairingCode: pairingCode.toUpperCase(),
    });
    return undefined;
  }, []);

  const connectRemoteDevice = useCallback(
    async (pairingCode: string) => {
      if (isConnectingRef.current) {
        return;
      }
      setIsConnecting(true);
      try {
        const p = connectRemoteDeviceFn(pairingCode);
        const timeoutMessage = 'TransferConnectRemoteDeviceTimeout';
        const result = await pTimeout(p, {
          // milliseconds: 1,
          milliseconds: 30_000,
          fallback: () => {
            return new OneKeyError(timeoutMessage);
          },
        });
        if (
          result instanceof OneKeyError &&
          result.message === timeoutMessage
        ) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.communication_timeout,
            }),
          });
          throw result;
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [connectRemoteDeviceFn, intl],
  );

  const cleanTextFn = useCallback((text: string) => {
    return text.replace(/[^a-zA-Z0-9-]/g, '').replace(/-/g, '');
  }, []);

  const handlePairingCodeChange = useCallback(
    (text: string, skipPreviousCheck = false) => {
      // Check if this is deletion by comparing lengths
      const previousCleanText = skipPreviousCheck
        ? ''
        : (remotePairingCode || '').replace(/[^a-zA-Z0-9-]/g, '');
      const currentCleanText = text.replace(/[^a-zA-Z0-9-]/g, '');
      const isDeleting = currentCleanText.length < previousCleanText.length;

      let formattedText = '';
      if (isDeleting) {
        // During deletion, only filter invalid characters and convert to uppercase
        // Don't do any separator manipulation to preserve cursor position
        formattedText = currentCleanText;
      } else {
        const groupSize = 5;
        const isAppendingInput = currentCleanText.startsWith(previousCleanText);
        if (isAppendingInput) {
          // During input, apply full formatting
          formattedText = stringUtils.addSeparatorToString({
            str: cleanTextFn(text),
            groupSize,
            separator: '-',
          });
        } else {
          let keepPrevious = false;
          if (currentCleanText.includes('--')) {
            keepPrevious = true;
          }
          if (!keepPrevious) {
            const arr = currentCleanText.split('-');
            for (let i = 0; i < arr.length; i += 1) {
              if (arr[i].length > groupSize) {
                keepPrevious = true;
                break;
              }
            }
          }
          if (keepPrevious) {
            formattedText = previousCleanText;
          } else {
            formattedText = currentCleanText;
          }
        }
      }

      const currentFormValue = form.getValues('pairingCode');
      if (formattedText !== currentFormValue) {
        // Update form value
        form.setValue('pairingCode', formattedText, {
          // shouldValidate: true,
          // shouldDirty: true,
        });
      }
      // Keep existing state sync for compatibility
      setRemotePairingCode(formattedText);

      if (skipPreviousCheck) {
        void form.trigger('pairingCode');
      }
    },
    [cleanTextFn, remotePairingCode, setRemotePairingCode, form],
  );

  // Form submit handler
  const onSubmit = useCallback(
    (data: IPrimeTransferForm) => {
      void connectRemoteDevice(data.pairingCode);
    },
    [connectRemoteDevice],
  );

  const addOns: IInputAddOnProps[] = [
    // platformEnv.isExtension
    //   ? null
    //   :
    supportPaste
      ? {
          iconName: 'ClipboardOutline' as IKeyOfIcons,
          onPress: async () => {
            const text = await getClipboard();
            if (text) {
              handlePairingCodeChange(text || '', true);
              clearText();
            }
          },
        }
      : null,
    {
      iconName: 'ScanOutline' as IKeyOfIcons,
      onPress: async () => {
        const result = await start({
          handlers: [],
          autoHandleResult: false,
        });
        handlePairingCodeChange(result?.raw || '', true);
      },
    },
  ].filter(Boolean);

  return (
    <Form form={form} childrenGap={0}>
      <YStack gap="$1">
        <Form.Field
          label={intl.formatMessage({ id: ETranslations.transfer_pair_code })}
          description={intl.formatMessage({
            id: ETranslations.transfer_enter_pair_code_desc,
          })}
          name="pairingCode"
          rules={{
            required: {
              value: true,
              message: intl.formatMessage({
                id: ETranslations.transfer_invalid_code,
              }),
            },
            onChange: (e) => {
              handlePairingCodeChange(
                (e as { target: { value: string } })?.target?.value || '',
                false,
              );
            },
            validate: {
              notSelfPairing: async (value) => {
                if (!value) {
                  return intl.formatMessage({
                    id: ETranslations.transfer_invalid_code,
                  });
                }
                try {
                  const remoteRoomId =
                    await backgroundApiProxy.servicePrimeTransfer.getRoomIdFromPairingCode(
                      value,
                    );
                  if (!remoteRoomId) {
                    return intl.formatMessage({
                      id: ETranslations.transfer_invalid_code,
                    });
                  }
                  if (
                    remoteRoomId &&
                    primeTransferAtom.myCreatedRoomId &&
                    remoteRoomId.toUpperCase() ===
                      primeTransferAtom.myCreatedRoomId.toUpperCase()
                  ) {
                    return intl.formatMessage({
                      id: ETranslations.transfer_pair_code_own_error,
                    });
                  }
                  return undefined;
                } catch {
                  return undefined;
                }
              },
              validPairingCode: async (value) => {
                if (!value) return undefined;
                try {
                  await backgroundApiProxy.servicePrimeTransfer.checkPairingCodeValidAsync(
                    value,
                  );
                  return undefined;
                } catch {
                  return intl.formatMessage({
                    id: ETranslations.transfer_invalid_code,
                  });
                }
              },
            },
          }}
        >
          {websocketConnected ? (
            <Input
              size="large"
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              maxLength={59}
              allowSecureTextEye
              onPaste={onPasteClearText}
              // Fix for Android secureTextEntry not working properly with autoComplete
              // See: https://stackoverflow.com/questions/54684814/react-native-securetextentry-not-working-on-android
              autoCapitalize="none"
              textTransform="uppercase"
              onSubmitEditing={form.handleSubmit(onSubmit)}
              placeholder="224RU-EZ172-4B483-ZN695-RM9XC-CJ6Z9-MQ67J-ZM3B2-4LXBS-JZP7D"
              addOns={addOns}
            />
          ) : (
            <Skeleton h={46} w="100%" borderRadius="$2" />
          )}
        </Form.Field>
      </YStack>

      <XStack>
        <Button
          mt="$4"
          onPress={form.handleSubmit(onSubmit)}
          variant="primary"
          loading={isConnecting}
          size={gtSm ? 'medium' : 'large'}
          width={gtSm ? 'auto' : '100%'}
          disabled={
            !form.formState.isValid || isConnecting || !websocketConnected
          }
        >
          {intl.formatMessage({ id: ETranslations.global_connect })}
        </Button>
      </XStack>
    </Form>
  );
}
