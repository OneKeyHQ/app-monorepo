import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { LayoutAnimationConfig } from 'react-native-reanimated';

import {
  Icon,
  NumberSizeableText,
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
  DetailRowMotion,
  formatPrice,
} from './DetailRow';
import { FeeRow } from './FeeRow';
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
  const providerLabel = intl.formatMessage({
    id: ETranslations.swap_history_detail_provider,
  });
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
      node: (
        <FeeRow
          networkFee={networkFee}
          transactionFee={transactionFee}
          isLoading={isQuoting}
        />
      ),
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
      {/* Rows that mount with the card arrive with the review block's own
          fade; only a row that lands later (network, address) fades in. */}
      <LayoutAnimationConfig skipEntering>
        {rows.map((row) => (
          // Keys keep surviving rows mounted when a late row arrives.
          <DetailRowMotion key={row.key}>{row.node}</DetailRowMotion>
        ))}
      </LayoutAnimationConfig>
    </YStack>
  );
}
