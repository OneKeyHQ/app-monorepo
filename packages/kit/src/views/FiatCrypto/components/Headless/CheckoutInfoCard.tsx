import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import {
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOnramperQuotePricing } from '@onekeyhq/shared/src/modules3rdParty/onramper';

import {
  DETAIL_CARD_PROPS,
  DetailAddressValue,
  DetailEmptyValue,
  DetailRow,
  INFO_TRIGGER_HIT_SLOP,
  formatPrice,
} from './DetailRow';
import {
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
  // change, nothing below the card moves.
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
  // Shown before the address, as on the order detail: the name is what the
  // user recognizes, the address is what they can check.
  accountName?: string;
  // When provided the provider row becomes tappable (provider switching).
  onSelectProvider?: () => void;
};

// The review breakdown, in the same card as the order detail so the two
// surfaces read as the same order. Quote-derived rows stay mounted through
// every state — skeleton while quoting, value once quoted, "--" when no quote
// is coming — so the card never changes height under the pay button; only the
// network and address rows can arrive later, and those fade in.
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
  accountName,
  onSelectProvider,
}: IProps) {
  const intl = useIntl();
  const feesLabel = intl.formatMessage({ id: ETranslations.fee_fee });
  const providerLabel = intl.formatMessage({
    id: ETranslations.swap_history_detail_provider,
  });
  const totalFee = (networkFee ?? 0) + (transactionFee ?? 0);
  const hasFee = networkFee !== undefined || transactionFee !== undefined;
  // Provider-rate value of the estimated receive (= amount − fees) and the
  // rate itself. Undefined until a full quote is in hand, or when the quote
  // can't be priced — the fiat figures are then hidden rather than replaced
  // with a different-meaning number. fiatAmount and the quote must describe
  // the same request: the hook keeps the last quote only while a NEW request
  // is in flight (preset tap after typing, provider switch) and drops it when
  // that request fails, so the !isQuoting gate — same as the hero estimate —
  // covers the one window where the two can disagree.
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
  // Loading and empty states for the quote-derived values.
  const pendingValue = isQuoting ? <Skeleton.BodyMd /> : <DetailEmptyValue />;

  let payoutValue: ReactNode = pendingValue;
  if (payout !== undefined) {
    payoutValue = (
      // Wraps the ≈fiat part onto its own line when a large payout leaves no
      // room for both.
      <XStack ai="center" jc="flex-end" flexWrap="wrap" columnGap="$1">
        {/* The one emphasized figure: what the user gets. */}
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
    );
  }

  let feeValue: ReactNode = pendingValue;
  if (hasFee) {
    feeValue = (
      <Popover
        title={feesLabel}
        renderTrigger={
          <XStack
            ai="center"
            gap="$1"
            cursor="pointer"
            role="button"
            hitSlop={INFO_TRIGGER_HIT_SLOP}
          >
            <NumberSizeableText
              size="$bodyMd"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {totalFee}
            </NumberSizeableText>
            <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
          </XStack>
        }
        renderContent={
          // The two rows are the explanation: a sentence naming the same two
          // fees above them would only repeat them.
          <YStack p="$5" gap="$3">
            {networkFee !== undefined ? (
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.swap_history_detail_network_fee,
                  })}
                </SizableText>
                <SizableText size="$bodyMd">
                  {formatPrice(networkFee)}
                </SizableText>
              </XStack>
            ) : null}
            {transactionFee !== undefined ? (
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.buy_transaction_fee__title,
                  })}
                </SizableText>
                <SizableText size="$bodyMd">
                  {formatPrice(transactionFee)}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
        }
      />
    );
  }

  const rows: { key: string; node: ReactNode }[] = [
    {
      key: 'payout',
      node: (
        <DetailRow
          label={intl.formatMessage({ id: ETranslations.earn_est_receive })}
        >
          {payoutValue}
        </DetailRow>
      ),
    },
    {
      key: 'rate',
      node: (
        <RateRow
          tokenSymbol={tokenSymbol}
          impliedPrice={pricing?.impliedPrice}
          providerName={providerName}
          isLoading={isQuoting}
        />
      ),
    },
    {
      key: 'fee',
      node: <DetailRow label={feesLabel}>{feeValue}</DetailRow>,
    },
    {
      key: 'provider',
      node: providerName ? (
        <DetailRow label={providerLabel} onPress={onSelectProvider}>
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
      ) : (
        <DetailRow label={providerLabel}>{pendingValue}</DetailRow>
      ),
    },
  ];
  if (networkName) {
    rows.push({
      key: 'network',
      node: (
        <DetailRow
          label={intl.formatMessage({ id: ETranslations.global_network })}
        >
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
        <DetailRow
          label={intl.formatMessage({
            id: ETranslations.receive_address__title,
          })}
        >
          <DetailAddressValue address={address} accountName={accountName} />
        </DetailRow>
      ),
    });
  }

  return (
    <YStack {...DETAIL_CARD_PROPS}>
      {rows.map((row) => (
        // Keys keep surviving rows mounted when a late row (network,
        // address) arrives; the layout prop glides them out of its way.
        <Animated.View
          key={row.key}
          entering={FadeIn.duration(MOTION_MICRO_MS).easing(MOTION_EASE_OUT)}
          exiting={FadeOut.duration(MOTION_EXIT_MS).easing(MOTION_EASE_OUT)}
          layout={LinearTransition.duration(MOTION_MICRO_MS).easing(
            MOTION_EASE_IN_OUT,
          )}
        >
          {row.node}
        </Animated.View>
      ))}
    </YStack>
  );
}
