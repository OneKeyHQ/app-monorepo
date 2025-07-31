import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  QRCode,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeTransferHomeQrCode() {
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [primeTransferAtom] = usePrimeTransferAtom();
  const themeVariant = useThemeVariant();
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
    <YStack
      borderRadius="$4"
      borderWidth={1}
      borderColor="$neutral3"
      alignSelf="center"
      width="100%"
      overflow="hidden"
    >
      <YStack gap="$3" w="100%" py="$4">
        <YStack gap="$2" ai="center">
          <SizableText color="$textDisabled" size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.transfer_transfer_scan_tips,
            })}
          </SizableText>
          {shouldShowSkeleton ? (
            <Skeleton h={232} w={232} borderRadius="$3" />
          ) : (
            <Stack
              p="$1.5"
              bg="#ffffff"
              borderRadius="$3"
              borderWidth={1}
              borderColor="$neutral2"
            >
              <QRCode value={pairingCode} size={208} />
            </Stack>
          )}
        </YStack>
        {shouldShowSkeleton ? (
          <Stack alignSelf="center">
            <Skeleton h={20} w={88} />
          </Stack>
        ) : (
          <Button
            variant="tertiary"
            icon="RefreshCwOutline"
            size="small"
            onPress={buildPairingCode}
            disabled={isGeneratingCode || !websocketConnected}
            title={intl.formatMessage({ id: ETranslations.global_refresh })}
            alignSelf="center"
          >
            {intl.formatMessage({ id: ETranslations.global_refresh })}
          </Button>
        )}
      </YStack>

      <YStack
        flex={1}
        alignItems="flex-start"
        w="100%"
        bg="$neutral2"
        borderTopWidth={1}
        borderTopColor="$neutral3"
        px="$4"
        py="$4"
      >
        <SizableText color="$text" size="$headingSm">
          {intl.formatMessage({ id: ETranslations.transfer_pair_code })}
        </SizableText>

        <XStack
          gap="$1"
          onPress={copyLink}
          ai="center"
          jc="space-between"
          hoverStyle={{
            opacity: 0.8,
            cursor: 'pointer',
          }}
          w="100%"
        >
          {shouldShowSkeleton ? (
            <YStack>
              {gtMd ? (
                <Skeleton.BodyMd w={320} />
              ) : (
                <>
                  <Skeleton.BodyMd w={230} />
                  <Skeleton.BodyMd w={114} />
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
