import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  Image,
  QRCode,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeTransferHomeQrCode() {
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [primeTransferAtom] = usePrimeTransferAtom();
  const websocketConnected = primeTransferAtom.websocketConnected;
  const { gtMd } = useMedia();

  const [pairingCode, setPairingCode] = useState<string | undefined>(undefined);
  const intl = useIntl();
  const { copyText } = useClipboard();

  const shouldShowSkeleton = !websocketConnected || isGeneratingCode;

  const copyLink = useCallback(() => {
    if (!pairingCode) {
      return;
    }
    if (shouldShowSkeleton) {
      return;
    }
    copyText(pairingCode);
  }, [copyText, pairingCode, shouldShowSkeleton]);

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

  return (
    <YStack gap="$2.5" alignItems="center">
      {shouldShowSkeleton ? (
        <Skeleton h={210} w={210} borderRadius="$2" />
      ) : (
        <QRCode value={pairingCode} size={200} />
      )}

      <Button
        variant="tertiary"
        icon="RefreshCwOutline"
        onPress={buildPairingCode}
        loading={isGeneratingCode}
        disabled={isGeneratingCode || !websocketConnected}
        title={intl.formatMessage({ id: ETranslations.global_refresh })}
      >
        {intl.formatMessage({ id: ETranslations.global_refresh })}
      </Button>

      <YStack flex={1} alignItems="flex-start" w="100%">
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
          {shouldShowSkeleton ? (
            <YStack gap="$1.5" mt="$1.5">
              {gtMd ? (
                <>
                  <Skeleton h="$3.5" w="$72" borderRadius="$1" />
                  {/* <Skeleton h="$3.5" w="$24" borderRadius="$1" /> */}
                </>
              ) : (
                <>
                  <Skeleton h="$3.5" w="$72" borderRadius="$1" />
                  <Skeleton h="$3.5" w="$24" borderRadius="$1" />
                </>
              )}
            </YStack>
          ) : (
            <>
              <SizableText
                flex={1}
                color="$textSubdued"
                size="$bodyMd"
                textAlign="left"
              >
                {pairingCode}
              </SizableText>
              <Stack w="$5">
                <Icon name="Copy3Outline" size="$5" color="$iconSubdued" />
              </Stack>
            </>
          )}
        </XStack>
      </YStack>
    </YStack>
  );
}
