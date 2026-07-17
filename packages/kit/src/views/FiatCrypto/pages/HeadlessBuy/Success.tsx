import type { ReactNode } from 'react';
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
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { ProviderLogo } from '../../components/Headless/ProviderLogo';

import type { RouteProp } from '@react-navigation/core';

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack jc="space-between" ai="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

// 中: post-payment result page. One centered group — the success landing
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
      <Page.Header title="訂單已提交" headerLeft={() => null} />
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
                支付成功
              </SizableText>
              <SizableText
                size="$bodyLg"
                color="$textSubdued"
                textAlign="center"
              >
                訂單已提交，{tokenSymbol} 將於稍後發送至你的地址
              </SizableText>
            </YStack>
            <YStack bg="$bgSubdued" borderRadius="$3" p="$4" w="100%" gap="$3">
              <DetailRow label="支付金額">
                <SizableText size="$bodyMdMedium">
                  {numberFormat(String(fiatAmount), {
                    formatter: 'price',
                    formatterOptions: { currency: '$' },
                  })}
                </SizableText>
              </DetailRow>
              {payout !== undefined ? (
                <DetailRow label="預估到賬">
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
                <DetailRow label="供應商">
                  <XStack ai="center" gap="$1.5">
                    <ProviderLogo provider={providerName} />
                    <SizableText size="$bodyMdMedium">
                      {providerName.charAt(0).toUpperCase() +
                        providerName.slice(1)}
                    </SizableText>
                  </XStack>
                </DetailRow>
              ) : null}
              <DetailRow label="網路">
                <XStack ai="center" gap="$1.5">
                  <NetworkAvatar networkId={networkId} size="$5" />
                  <SizableText size="$bodyMdMedium">
                    {networkName ?? ''}
                  </SizableText>
                </XStack>
              </DetailRow>
              {address ? (
                <DetailRow label="收款地址">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({ address })}
                  </SizableText>
                </DetailRow>
              ) : null}
              {checkoutId ? (
                <DetailRow label="訂單編號">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({ address: checkoutId })}
                  </SizableText>
                </DetailRow>
              ) : null}
            </YStack>
          </YStack>
        </Stack>
      </Page.Body>
      <Page.Footer onConfirm={handleDone} onConfirmText="完成" />
    </Page>
  );
}

export default HeadlessBuySuccessPage;
