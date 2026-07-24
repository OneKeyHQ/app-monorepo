// cspell: words unifold Unifold
import {
  DashText,
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
import { Token } from '@onekeyhq/kit/src/components/Token';
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
  sourceTokenSymbol,
  sourceTokenIconUri,
  receiveTokenSymbol,
  receiveTokenIconUri,
  receiveNetworkIconUri,
}: {
  address: string | null;
  chainIconUri?: string;
  loading: boolean;
  sourceTokenSymbol?: string;
  sourceTokenIconUri?: string;
  receiveTokenSymbol?: string;
  receiveTokenIconUri?: string;
  receiveNetworkIconUri?: string;
}) {
  const { copyText } = useClipboard();
  const showConversionRoute = Boolean(
    (address || loading) && sourceTokenSymbol && receiveTokenSymbol,
  );

  return (
    <YStack
      testID="perps-unifold-deposit-qr-card"
      py="$3"
      alignItems="center"
      gap="$6"
    >
      {!loading && !address ? (
        <YStack
          width={QR_SIZE}
          height={QR_SIZE}
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <Stack
            width="$10"
            height="$10"
            borderRadius="$full"
            bg="$bgInfoSubdued"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name="InfoCircleOutline" size="$5" color="$iconInfo" />
          </Stack>
          <SizableText size="$bodyMdMedium" color="$text">
            Address unavailable
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            textAlign="center"
            maxWidth="$48"
          >
            Choose another token or network to continue.
          </SizableText>
        </YStack>
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
      {showConversionRoute ? (
        <XStack
          testID="perps-unifold-conversion-route"
          width="auto"
          maxWidth="100%"
          minHeight="$12"
          px="$4"
          py="$1.5"
          alignItems="center"
          justifyContent="center"
          gap="$3"
          bg="$bgStrong"
          borderRadius="$full"
        >
          <XStack flexShrink={1} minWidth={0} alignItems="center" gap="$2">
            <Token
              size="sm"
              tokenImageUri={normalizeUnifoldIconUrl(sourceTokenIconUri)}
              networkImageUri={normalizeUnifoldIconUrl(chainIconUri)}
            />
            <YStack minWidth={0}>
              <SizableText size="$bodyXs" color="$textSubdued">
                You send
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
                {sourceTokenSymbol}
              </SizableText>
            </YStack>
          </XStack>
          <Icon
            name="ArrowRightOutline"
            size="$5"
            color="$iconDisabled"
            flexShrink={0}
          />
          <XStack flexShrink={1} minWidth={0} alignItems="center" gap="$2">
            <Token
              size="sm"
              tokenImageUri={normalizeUnifoldIconUrl(receiveTokenIconUri)}
              networkImageUri={normalizeUnifoldIconUrl(receiveNetworkIconUri)}
            />
            <YStack minWidth={0}>
              <SizableText size="$bodyXs" color="$textSubdued">
                You receive
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
                {receiveTokenSymbol}
              </SizableText>
            </YStack>
          </XStack>
        </XStack>
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
            <XStack flex={1} minWidth={0}>
              <DashText
                size="$bodySm"
                color="$textSubdued"
                dashColor="$textDisabled"
                dashThickness={0.5}
                tooltip="Send the selected token on the selected network to this address. It will be converted to USDC and deposited into your Perps account."
                tooltipTitle="Deposit address"
                tooltipPlacement="bottom-start"
              >
                Your deposit address
              </DashText>
            </XStack>
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
            <Skeleton width="100%" height={64} borderRadius="$3" />
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
