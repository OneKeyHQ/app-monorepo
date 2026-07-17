import type { ReactNode } from 'react';
import { Fragment, useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Divider,
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
    <XStack py="$2" jc="space-between" ai="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

// 中: post-payment result page, laid out to MATCH the buy/review screen:
// success hero (icon + 支付成功 + desc) centered in the space the details
// leave, order details as a flat divider-separated list at the bottom, and
// the standard modal footer. Reached via CommonActions.reset — the buy flow
// behind it no longer exists in the stack, so back gestures can only dismiss
// the whole modal. Copy stays honest about the asynchronous settlement: the
// order is SUBMITTED; delivery happens server-side later.
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

  const rows: { key: string; node: ReactNode }[] = [];
  rows.push({
    key: 'fiatAmount',
    node: (
      <DetailRow label="支付金額">
        <SizableText size="$bodyMdMedium">
          {numberFormat(String(fiatAmount), {
            formatter: 'price',
            formatterOptions: { currency: '$' },
          })}
        </SizableText>
      </DetailRow>
    ),
  });
  if (payout !== undefined) {
    rows.push({
      key: 'payout',
      node: (
        <DetailRow label="預估到賬">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol }}
          >
            {payout}
          </NumberSizeableText>
        </DetailRow>
      ),
    });
  }
  if (providerName) {
    rows.push({
      key: 'provider',
      node: (
        <DetailRow label="供應商">
          <XStack ai="center" gap="$1.5">
            <ProviderLogo provider={providerName} />
            <SizableText size="$bodyMd">
              {providerName.charAt(0).toUpperCase() + providerName.slice(1)}
            </SizableText>
          </XStack>
        </DetailRow>
      ),
    });
  }
  rows.push({
    key: 'network',
    node: (
      <DetailRow label="網路">
        <XStack ai="center" gap="$1.5">
          <NetworkAvatar networkId={networkId} size="$5" />
          <SizableText size="$bodyMd">{networkName ?? ''}</SizableText>
        </XStack>
      </DetailRow>
    ),
  });
  if (address) {
    rows.push({
      key: 'address',
      node: (
        <DetailRow label="收款地址">
          <SizableText size="$bodyMd">
            {accountUtils.shortenAddress({ address })}
          </SizableText>
        </DetailRow>
      ),
    });
  }
  if (checkoutId) {
    rows.push({
      key: 'checkoutId',
      node: (
        <DetailRow label="訂單編號">
          <SizableText size="$bodyMd">
            {accountUtils.shortenAddress({ address: checkoutId })}
          </SizableText>
        </DetailRow>
      ),
    });
  }

  return (
    <Page>
      <Page.Header title="訂單已提交" headerLeft={() => null} />
      <Page.Body px="$5" pb="$3">
        <YStack flex={1}>
          {/* Success hero — centered in whatever space the details leave,
              mirroring the amount hero on the buy screen. */}
          <Stack flex={1} jc="center" ai="center">
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
            </YStack>
          </Stack>
          {/* Order details — same flat divider-separated list as the review
              screen's breakdown. */}
          <YStack>
            {rows.map((row, index) => (
              <Fragment key={row.key}>
                {index > 0 ? <Divider my="$1" /> : null}
                {row.node}
              </Fragment>
            ))}
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer onConfirm={handleDone} onConfirmText="完成" />
    </Page>
  );
}

export default HeadlessBuySuccessPage;
