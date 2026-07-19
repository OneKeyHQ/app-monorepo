import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  LottieView,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { DetailRow, formatPrice } from '../../components/Headless/DetailRow';
import {
  ProviderLogo,
  getProviderDisplayName,
} from '../../components/Headless/ProviderLogo';

import type { RouteProp } from '@react-navigation/core';

// Post-payment result page. One centered group — the success landing
// animation (the same Lottie the Swap/DeFi results use), title/description,
// and the order details in a compact card (no dividers). Reached via
// CommonActions.reset — the buy flow behind it no longer exists in the stack,
// so back gestures can only dismiss the whole modal. Copy stays honest about
// the asynchronous settlement: the order is SUBMITTED; delivery happens
// server-side later.
function HeadlessBuySuccessPage() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.HeadlessBuySuccess
      >
    >();
  const {
    fiatAmount,
    tokenSymbol,
    networkId,
    networkName,
    payout,
    providerName,
    address,
    checkoutId,
  } = route.params;

  const handleDone = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  return (
    <Page>
      <Page.Header title="Order submitted" headerLeft={() => null} />
      <Page.Body px="$5" pb="$3">
        <Stack flex={1} jc="center">
          <YStack ai="center" gap="$6">
            {/* Same landing animation the Swap/DeFi success results use. */}
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
              width={110}
              height={110}
              autoPlay
              loop={false}
            />
            <YStack ai="center" gap="$2">
              <SizableText size="$headingXl" textAlign="center">
                Payment successful
              </SizableText>
              <SizableText
                size="$bodyLg"
                color="$textSubdued"
                textAlign="center"
              >
                Order submitted — {tokenSymbol} will be sent to your address
                shortly
              </SizableText>
            </YStack>
            <YStack bg="$bgSubdued" borderRadius="$3" p="$4" w="100%" gap="$3">
              <DetailRow label="Amount paid">
                <SizableText size="$bodyMdMedium">
                  {formatPrice(fiatAmount)}
                </SizableText>
              </DetailRow>
              {payout !== undefined ? (
                <DetailRow label="Est. receive">
                  <NumberSizeableText
                    size="$bodyMdMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol }}
                  >
                    {payout}
                  </NumberSizeableText>
                </DetailRow>
              ) : null}
              {providerName ? (
                <DetailRow label="Provider">
                  <XStack ai="center" gap="$1.5">
                    <ProviderLogo provider={providerName} />
                    <SizableText size="$bodyMdMedium">
                      {getProviderDisplayName(providerName)}
                    </SizableText>
                  </XStack>
                </DetailRow>
              ) : null}
              <DetailRow label="Network">
                <XStack ai="center" gap="$1.5">
                  <NetworkAvatar networkId={networkId} size="$5" />
                  <SizableText size="$bodyMdMedium">
                    {networkName ?? ''}
                  </SizableText>
                </XStack>
              </DetailRow>
              {address ? (
                <DetailRow label="Receiving address">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({ address })}
                  </SizableText>
                </DetailRow>
              ) : null}
              {checkoutId ? (
                <DetailRow label="Order ID">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({ address: checkoutId })}
                  </SizableText>
                </DetailRow>
              ) : null}
            </YStack>
          </YStack>
        </Stack>
      </Page.Body>
      <Page.Footer onConfirm={handleDone} onConfirmText="Done" />
    </Page>
  );
}

export default HeadlessBuySuccessPage;
