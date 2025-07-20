import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Input,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

export function PrimeTransferHomeEnterLink({
  remotePairingCode,
  setRemotePairingCode,
}: {
  remotePairingCode: string;
  setRemotePairingCode: (code: string) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { start } = useScanQrCode();
  const { onPasteClearText, clearText, getClipboard } = useClipboard();
  const [isConnecting, setIsConnecting] = useState(false);

  const [primeTransferAtom] = usePrimeTransferAtom();

  const connectRemoteDevice = useCallback(async () => {
    const remoteRoomId =
      await backgroundApiProxy.servicePrimeTransfer.getRoomIdFromPairingCode(
        remotePairingCode,
      );
    if (!remoteRoomId || !remotePairingCode) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.transfer_invalid_code }),
      });
      return;
    }
    if (
      remoteRoomId &&
      primeTransferAtom.myCreatedRoomId &&
      remoteRoomId.toUpperCase() ===
        primeTransferAtom.myCreatedRoomId.toUpperCase()
    ) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.transfer_pair_code_own_error,
        }),
      });
      return;
    }
    setIsConnecting(true);
    try {
      await backgroundApiProxy.servicePrimeTransfer.checkPairingCodeValidAsync(
        remotePairingCode,
      );
      await backgroundApiProxy.servicePrimeTransfer.joinRoom({
        roomId: remoteRoomId,
      });
      await backgroundApiProxy.servicePrimeTransfer.verifyPairingCode({
        pairingCode: remotePairingCode.toUpperCase(),
      });
    } finally {
      setIsConnecting(false);
    }
  }, [intl, primeTransferAtom.myCreatedRoomId, remotePairingCode]);

  const cleanTextFn = useCallback((text: string) => {
    return text.replace(/[^a-zA-Z0-9-]/g, '').replace(/-/g, '');
  }, []);

  const handlePairingCodeChange = useCallback(
    (text: string) => {
      // Check if this is deletion by comparing lengths
      const previousCleanText = (remotePairingCode || '').replace(
        /[^a-zA-Z0-9-]/g,
        '',
      );
      const currentCleanText = text.replace(/[^a-zA-Z0-9-]/g, '');
      const isDeleting = currentCleanText.length < previousCleanText.length;

      if (isDeleting) {
        // During deletion, only filter invalid characters and convert to uppercase
        // Don't do any separator manipulation to preserve cursor position
        setRemotePairingCode(currentCleanText);
      } else {
        const groupSize = 5;
        const isAppendingInput = currentCleanText.startsWith(previousCleanText);
        if (isAppendingInput) {
          // During input, apply full formatting
          const formattedText = stringUtils.addSeparatorToString({
            str: cleanTextFn(text),
            groupSize,
            separator: '-',
          });
          setRemotePairingCode(formattedText);
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
            setRemotePairingCode(previousCleanText);
          } else {
            setRemotePairingCode(currentCleanText);
          }
        }
      }
    },
    [cleanTextFn, remotePairingCode, setRemotePairingCode],
  );

  if (!primeTransferAtom.websocketConnected) {
    return <Spinner size="large" />;
  }

  return (
    <>
      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.transfer_pair_code })}
        </SizableText>

        <Input
          size="large"
          maxLength={59}
          value={remotePairingCode}
          onChangeText={handlePairingCodeChange}
          onPaste={onPasteClearText}
          autoCapitalize="characters"
          textTransform="uppercase"
          placeholder="224RU-EZ172-4B483-ZN695-RM9XC-CJ6Z9-MQ67J-ZM3B2-4LXBS-JZP7D"
          addOns={[
            {
              iconName: 'ClipboardOutline',
              onPress: async () => {
                const text = await getClipboard();
                if (text) {
                  handlePairingCodeChange(text || '');
                  clearText();
                }
              },
            },
            {
              iconName: 'ScanOutline',
              onPress: async () => {
                const result = await start({
                  handlers: [],
                  autoHandleResult: false,
                });
                handlePairingCodeChange(result?.raw || '');
              },
            },
          ]}
        />

        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.transfer_enter_pair_code_desc,
          })}
        </SizableText>
      </YStack>

      <XStack>
        <Button
          mt="$4"
          onPress={connectRemoteDevice}
          variant="primary"
          loading={isConnecting}
          disabled={isConnecting}
        >
          {intl.formatMessage({ id: ETranslations.global_connect })}
        </Button>
      </XStack>
    </>
  );
}
