import type { ReactNode } from 'react';

import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import {
  Divider,
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { getOnramperQuotePricing } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { DetailRow, formatPrice } from './DetailRow';
import {
  MOTION_EASE_IN,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
  MOTION_EXIT_MS,
  MOTION_MICRO_MS,
} from './motionTokens';
import { ProviderLogo, getProviderDisplayName } from './ProviderLogo';
import { RateRow } from './RateRow';

type IProps = {
  tokenSymbol: string;
  // OneKey network id — renders the network's logo before its name.
  networkId?: string;
  networkName?: string;
  // A quote is in flight. Quote-derived rows render as SKELETONS instead of
  // unmounting, so the quote landing fills values in place — zero layout
  // change, nothing below the card moves (the pay zone below is hard-swap by
  // design and must not be displaced).
  isQuoting?: boolean;
  // Fiat the user pays, in the quote's source currency. Together with the
  // quote's fees it prices the payout at the provider's own rate
  // (getOnramperQuotePricing) — NOT at OneKey's market price: the provider's
  // spread (~3% on Coinbase Pay) made the market-priced figure disagree with
  // "amount − fees", which read as a fee error (2026-09-23 production orders).
  fiatAmount?: number;
  payout?: number;
  networkFee?: number;
  transactionFee?: number;
  providerName?: string;
  // Destination wallet address — always shown when known so the user can
  // confirm where the funds land before paying.
  address?: string;
  // When provided the provider row becomes tappable (provider switching).
  onSelectProvider?: () => void;
};

// The review breakdown — a flat list of label/value rows with a divider
// between every adjacent pair. Rows render conditionally, so they are
// collected first and the dividers interleaved; each bundle fades in/out on
// appearance. No height animation here by design: the hero container above
// owns the layout transition.
export function CheckoutInfoCard({
  tokenSymbol,
  networkId,
  networkName,
  isQuoting,
  fiatAmount,
  payout,
  networkFee,
  transactionFee,
  providerName,
  address,
  onSelectProvider,
}: IProps) {
  const totalFee = (networkFee ?? 0) + (transactionFee ?? 0);
  const hasFee = networkFee !== undefined || transactionFee !== undefined;
  // Provider-rate value of the estimated receive (= amount − fees) and the
  // rate itself. Undefined until a full quote is in hand, or when the quote
  // can't be priced — the fiat figures are then hidden rather than replaced
  // with a different-meaning number. Gated on !isQuoting like the hero
  // estimate: the hook keeps the last quote while a NEW amount is in flight
  // (preset tap after typing), and pricing that stale payout against the new
  // amount would show wrong figures for the in-flight window.
  const pricing =
    !isQuoting &&
    fiatAmount !== undefined &&
    payout !== undefined &&
    networkFee !== undefined &&
    transactionFee !== undefined
      ? getOnramperQuotePricing({
          amount: fiatAmount,
          payout,
          networkFee,
          transactionFee,
        })
      : undefined;
  const rows: { key: string; node: ReactNode }[] = [];
  rows.push({
    key: 'payout',
    node: (
      <DetailRow label="Est. receive" py="$2">
        {payout !== undefined ? (
          <XStack ai="center" gap="$1">
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol }}
            >
              {payout}
            </NumberSizeableText>
            {/* ≈ because the payout itself is the provider's estimate; the
                delivered amount settles at execution. */}
            {pricing ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {`(≈${formatPrice(pricing.payoutFiatValue)})`}
              </SizableText>
            ) : null}
          </XStack>
        ) : (
          // Typography-matched with the $bodyMdMedium value it replaces.
          <Skeleton.BodyMd />
        )}
      </DetailRow>
    ),
  });
  if (pricing || isQuoting) {
    rows.push({
      key: 'rate',
      node: (
        <RateRow
          tokenSymbol={tokenSymbol}
          impliedPrice={pricing?.impliedPrice}
          providerName={providerName}
          py="$2"
        />
      ),
    });
  }
  if (hasFee || isQuoting) {
    rows.push({
      key: 'fee',
      node: (
        <DetailRow label="Fees" py="$2">
          {!hasFee ? (
            <Skeleton.BodyMd />
          ) : (
            <Popover
              title="Fees"
              renderTrigger={
                <XStack ai="center" gap="$1" cursor="pointer">
                  <NumberSizeableText
                    size="$bodyMd"
                    formatter="price"
                    formatterOptions={{ currency: '$' }}
                  >
                    {totalFee}
                  </NumberSizeableText>
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                </XStack>
              }
              renderContent={
                <YStack p="$5" gap="$3">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {networkName
                      ? `Fees consist of the ${networkName} network fee and the transaction fee.`
                      : 'Fees consist of the network fee and the transaction fee.'}
                  </SizableText>
                  {networkFee !== undefined ? (
                    <XStack jc="space-between" ai="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        Network fee
                      </SizableText>
                      <SizableText size="$bodyMd">
                        {formatPrice(networkFee)}
                      </SizableText>
                    </XStack>
                  ) : null}
                  {transactionFee !== undefined ? (
                    <XStack jc="space-between" ai="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        Transaction fee
                      </SizableText>
                      <SizableText size="$bodyMd">
                        {formatPrice(transactionFee)}
                      </SizableText>
                    </XStack>
                  ) : null}
                </YStack>
              }
            />
          )}
        </DetailRow>
      ),
    });
  }
  if (providerName || isQuoting) {
    rows.push({
      key: 'provider',
      node: !providerName ? (
        <DetailRow label="Provider" py="$2">
          <Skeleton.BodyMd />
        </DetailRow>
      ) : (
        <DetailRow label="Provider" py="$2" onPress={onSelectProvider}>
          <XStack ai="center" gap="$1.5">
            <ProviderLogo provider={providerName} />
            <SizableText size="$bodyMd">
              {getProviderDisplayName(providerName)}
            </SizableText>
            {onSelectProvider ? (
              <Icon
                name="ChevronDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            ) : null}
          </XStack>
        </DetailRow>
      ),
    });
  }
  if (networkName) {
    rows.push({
      key: 'network',
      node: (
        <DetailRow label="Network" py="$2">
          <XStack ai="center" gap="$1.5">
            {networkId ? (
              <NetworkAvatar networkId={networkId} size="$5" />
            ) : null}
            <SizableText size="$bodyMd">{networkName}</SizableText>
          </XStack>
        </DetailRow>
      ),
    });
  }
  if (address) {
    rows.push({
      key: 'address',
      node: (
        <DetailRow label="Receiving address" py="$2">
          <SizableText size="$bodyMd">
            {accountUtils.shortenAddress({ address })}
          </SizableText>
        </DetailRow>
      ),
    });
  }

  return (
    <YStack>
      {rows.map((row, index) => (
        // Each bundle (leading divider + row) fades as one unit; keys keep
        // React from remounting surviving rows when a neighbor toggles, and
        // the layout prop glides survivors into the gap a neighbor leaves
        // (or out of the way of one appearing) instead of snapping.
        <Animated.View
          key={row.key}
          entering={FadeIn.duration(MOTION_MICRO_MS).easing(MOTION_EASE_OUT)}
          exiting={FadeOut.duration(MOTION_EXIT_MS).easing(MOTION_EASE_IN)}
          layout={LinearTransition.duration(MOTION_MICRO_MS).easing(
            MOTION_EASE_IN_OUT,
          )}
        >
          {index > 0 ? <Divider my="$1" /> : null}
          {row.node}
        </Animated.View>
      ))}
    </YStack>
  );
}
