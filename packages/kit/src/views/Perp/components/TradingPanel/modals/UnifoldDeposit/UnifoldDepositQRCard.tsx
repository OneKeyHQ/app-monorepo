// cspell: words unifold Unifold
import { useEffect, useRef, useState } from 'react';

import {
  Icon,
  QRCode,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

const QR_SIZE = 180;

// "Intent address" QR block. Deviation from the SDK (documented in the plan):
// OneKey's QRCode always renders on an opaque light plate so it stays
// scannable in dark mode; the SDK's transparent-background QR is not
// replicated. The center logo is the selected chain icon, like the SDK.
export function UnifoldDepositQRCard({
  address,
  chainIconUri,
  loading,
}: {
  address: string | null;
  chainIconUri?: string;
  loading: boolean;
}) {
  const { copyText } = useClipboard();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  return (
    <YStack alignItems="center" pt="$2">
      <SizableText size="$bodySm" color="$textSubdued" mb="$2">
        Intent address
      </SizableText>
      <YStack
        p="$3"
        bg="$bgSubdued"
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
        alignItems="center"
      >
        {loading || !address ? (
          <Skeleton width={QR_SIZE} height={QR_SIZE} radius={8} />
        ) : (
          <QRCode
            value={address}
            size={QR_SIZE}
            drawType="dot"
            {...(chainIconUri ? { logo: { uri: chainIconUri } } : {})}
          />
        )}
      </YStack>
      <XStack
        mt="$2"
        px="$2"
        py="$1"
        gap="$1.5"
        alignItems="center"
        borderRadius="$2"
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={() => {
          if (!address) {
            return;
          }
          copyText(address);
          setCopied(true);
          if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
          }
          copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
        }}
      >
        {address ? (
          <>
            <SizableText size="$bodyMd" color="$text">
              {accountUtils.shortenAddress({
                address,
                leadingLength: 8,
                trailingLength: 6,
              })}
            </SizableText>
            <Icon
              name={copied ? 'CheckLargeOutline' : 'Copy3Outline'}
              size="$4"
              color={copied ? '$iconSuccess' : '$iconSubdued'}
            />
          </>
        ) : (
          <Skeleton width={128} height={16} radius={4} />
        )}
      </XStack>
    </YStack>
  );
}
