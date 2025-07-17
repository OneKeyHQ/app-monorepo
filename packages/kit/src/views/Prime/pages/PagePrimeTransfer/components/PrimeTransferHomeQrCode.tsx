import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  QRCode,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeTransferHomeQrCode() {
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [primeTransferAtom] = usePrimeTransferAtom();
  const [pairingCode, setPairingCode] = useState<string | undefined>(undefined);
  const intl = useIntl();
  const { copyText } = useClipboard();

  const copyLink = useCallback(() => {
    if (!pairingCode) {
      return;
    }
    copyText(pairingCode);
  }, [copyText, pairingCode]);

  const buildPairingCode = useCallback(async () => {
    if (!primeTransferAtom.websocketConnected) {
      setPairingCode(undefined);
      return;
    }
    setIsGeneratingCode(true);
    try {
      const codeInfo =
        await backgroundApiProxy.servicePrimeTransfer.generateConnectionCode();
      const roomInfo =
        await backgroundApiProxy.servicePrimeTransfer.createRoom();
      if (roomInfo?.roomId && codeInfo?.code && codeInfo?.codeWithSeparator) {
        setPairingCode(`${roomInfo.roomId}-${codeInfo.codeWithSeparator}`);
      } else {
        setPairingCode(undefined);
      }
    } finally {
      setIsGeneratingCode(false);
    }
  }, [primeTransferAtom.websocketConnected]);

  useEffect(() => {
    void buildPairingCode();
  }, [buildPairingCode]);

  useEffect(() => {
    void backgroundApiProxy.servicePrimeTransfer.updateSelfPairingCode({
      pairingCode: pairingCode || '',
    });
  }, [pairingCode]);

  if (!primeTransferAtom.websocketConnected) {
    return <Spinner size="large" />;
  }

  if (isGeneratingCode) {
    return <Spinner size="large" />;
  }

  return (
    <YStack gap="$2.5" alignItems="center">
      <QRCode value={pairingCode} size={200} />

      <SizableText color="$text" size="$bodyLgMedium">
        {intl.formatMessage({ id: ETranslations.transfer_pair_code })}
      </SizableText>

      <XStack
        gap="$2"
        onPress={copyLink}
        alignItems="center"
        hoverStyle={{
          opacity: 0.8,
          cursor: 'pointer',
        }}
      >
        <SizableText
          flex={1}
          color="$textSubdued"
          size="$bodyMd"
          textAlign="center"
        >
          {pairingCode}
        </SizableText>
        <Stack w="$5">
          <Icon name="Copy3Outline" size="$5" color="$iconSubdued" />
        </Stack>
      </XStack>
    </YStack>
  );
}
