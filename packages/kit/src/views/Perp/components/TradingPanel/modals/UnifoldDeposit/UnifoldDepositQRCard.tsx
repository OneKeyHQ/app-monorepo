// cspell: words unifold Unifold
import {
  Icon,
  QRCode,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { normalizeUnifoldIconUrl } from './unifoldFormat';

const QR_SIZE = 200;
const UNIFOLD_TERMS_URL = 'https://unifold.io/terms';
const UNIFOLD_HELP_URL = 'https://unifold.io/support';

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

  return (
    <YStack
      testID="perps-unifold-deposit-qr-card"
      py="$3"
      alignItems="center"
      gap="$6"
    >
      {!loading && !address ? (
        // Mirrors the SDK: an address that never arrives must say so rather
        // than leave a skeleton spinning forever.
        <Stack
          width={QR_SIZE}
          height={QR_SIZE}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText size="$bodyMd" color="$textCritical">
            No address available
          </SizableText>
        </Stack>
      ) : null}
      {loading ? (
        <Skeleton width={QR_SIZE} height={QR_SIZE} radius={8} />
      ) : null}
      {!loading && address ? (
        <QRCode
          value={address}
          size={QR_SIZE}
          drawType="dot"
          {...(normalizeUnifoldIconUrl(chainIconUri)
            ? {
                logo: {
                  uri: normalizeUnifoldIconUrl(chainIconUri) as string,
                },
              }
            : {})}
        />
      ) : null}
      {/* Hidden entirely when there is no address to show and none is coming:
            a shimmering skeleton under the "No address available" plate would
            contradict it, in a row that still looks pressable. */}
      {address || loading ? (
        <YStack width="100%" gap="$2">
          <XStack
            width="100%"
            maxWidth="100%"
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flex={1}
              minWidth={0}
            >
              Your deposit address
            </SizableText>
            <XStack alignItems="center" gap="$2" flexShrink={0}>
              <SizableText
                testID="perps-unifold-terms"
                size="$bodySm"
                color="$textInfo"
                role="link"
                cursor="pointer"
                userSelect="none"
                hoverStyle={{ color: '$textInfoStrong' }}
                pressStyle={{ color: '$textInfoStrong' }}
                onPress={() => openUrlExternal(UNIFOLD_TERMS_URL)}
              >
                Terms
              </SizableText>
              <SizableText
                testID="perps-unifold-help"
                size="$bodySm"
                color="$textInfo"
                role="link"
                cursor="pointer"
                userSelect="none"
                hoverStyle={{ color: '$textInfoStrong' }}
                pressStyle={{ color: '$textInfoStrong' }}
                onPress={() => openUrlExternal(UNIFOLD_HELP_URL)}
              >
                Help
              </SizableText>
            </XStack>
          </XStack>
          {address ? (
            <XStack
              testID="perps-unifold-copy-deposit-address"
              width="100%"
              px="$3"
              py="$4"
              gap="$3"
              alignItems="flex-start"
              bg="$bgStrong"
              borderRadius="$3"
              role="button"
              cursor="pointer"
              userSelect="none"
              hoverStyle={{ bg: '$bgStrongHover' }}
              pressStyle={{ bg: '$bgStrongActive' }}
              onPress={() => copyText(address)}
              focusable
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineOffset: 2,
                outlineStyle: 'solid',
              }}
            >
              <XStack flex={1} flexWrap="wrap">
                <HighlightAddress
                  address={address}
                  size="$bodyMd"
                  fontFamily="$monoRegular"
                />
              </XStack>
              <Stack mt="$0.5" flexShrink={0}>
                <Icon name="Copy3Outline" size="$5" color="$iconSubdued" />
              </Stack>
            </XStack>
          ) : null}
          {!address && loading ? (
            <YStack width="100%" p="$3" bg="$bgStrong" borderRadius="$3">
              <Skeleton width="100%" height={40} radius={8} />
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
