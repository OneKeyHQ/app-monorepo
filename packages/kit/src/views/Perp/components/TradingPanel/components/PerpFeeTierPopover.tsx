import { memo, useCallback, useMemo, useState } from 'react';

import {
  Badge,
  Divider,
  Icon,
  Image,
  Popover,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  DEMO_USER_FEE_DATA,
  HYPE_STAKING_TIERS,
  HYPERLIQUID_FEE_TIERS,
  WALLET_BUILDER_FEES,
  formatFeePercent,
} from './feeTierData';

function FeeRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText
        size={bold ? '$bodyMdMedium' : '$bodySm'}
        color="$textSubdued"
      >
        {label}
      </SizableText>
      <SizableText
        size={bold ? '$bodyMdMedium' : '$bodySm'}
        color={bold ? '$text' : '$textSubdued'}
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function FeeProgressBar({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  return (
    <Stack h={4} bg="$bgStrong" borderRadius="$full" overflow="hidden">
      <Stack
        h="100%"
        borderRadius="$full"
        bg={color as any}
        width={`${Math.max(percent, 2)}%`}
      />
    </Stack>
  );
}

function WalletRow({
  name,
  totalTakerFee,
  maxTakerFee,
  icon,
  color,
  isHighlighted,
}: {
  name: string;
  totalTakerFee: number;
  maxTakerFee: number;
  icon: number;
  color: string;
  isHighlighted?: boolean;
}) {
  const barPercent = maxTakerFee > 0 ? (totalTakerFee / maxTakerFee) * 100 : 0;

  return (
    <YStack
      py="$1.5"
      px="$2"
      borderRadius="$2"
      gap="$1.5"
      {...(isHighlighted && { bg: '$bgSuccessSubdued' })}
    >
      <XStack alignItems="center">
        <XStack flex={1} alignItems="center" gap="$2">
          <Image
            source={icon}
            size="$5"
            borderRadius="$full"
          />
          <SizableText size="$bodySm" color="$text" numberOfLines={1}>
            {name}
          </SizableText>
          {isHighlighted ? (
            <Badge badgeType="success" badgeSize="sm">
              Overall Best
            </Badge>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatFeePercent(totalTakerFee)}
        </SizableText>
      </XStack>
      <FeeProgressBar percent={barPercent} color={color} />
    </YStack>
  );
}

function YourFeesSection({
  builderFee,
  computedFees,
  feeTier,
  stakingTier,
}: {
  builderFee: number;
  computedFees: {
    tierData: (typeof HYPERLIQUID_FEE_TIERS)[number];
    stakingDiscount: number;
    hlTaker: number;
    hlMaker: number;
    totalTaker: number;
    totalMaker: number;
  };
  feeTier: number;
  stakingTier: string;
}) {
  return (
    <YStack gap="$2">
      <YStack gap="$1.5">
        <FeeRow
          label="Builder Fee (OneKey)"
          value={formatFeePercent(builderFee)}
        />
        <FeeRow
          label="Hyperliquid Fee (Taker)"
          value={formatFeePercent(computedFees.hlTaker)}
        />
        <FeeRow
          label="Hyperliquid Fee (Maker)"
          value={formatFeePercent(computedFees.hlMaker)}
        />
      </YStack>
      <Divider />
      <YStack gap="$1.5">
        <FeeRow
          label="Total Taker Fee"
          value={formatFeePercent(computedFees.totalTaker)}
          bold
        />
        <FeeRow
          label="Total Maker Fee"
          value={formatFeePercent(computedFees.totalMaker)}
          bold
        />
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        <Badge badgeType="info">
          {`Fee Tier ${feeTier} (${computedFees.tierData.label})`}
        </Badge>
        <Badge badgeType="info">
          {`${stakingTier} Staking (${Math.round(computedFees.stakingDiscount * 100)}% off)`}
        </Badge>
      </XStack>
    </YStack>
  );
}

function WalletComparisonSection({
  computedFees,
}: {
  computedFees: {
    hlTaker: number;
    hlMaker: number;
  };
}) {
  const maxTakerFee = useMemo(() => {
    const fees = WALLET_BUILDER_FEES.map(
      (w) => w.builderFee + computedFees.hlTaker,
    );
    return Math.max(...fees);
  }, [computedFees.hlTaker]);

  return (
    <YStack gap="$1">
      <XStack alignItems="center" px="$2" pb="$1">
        <SizableText flex={1} size="$bodyXs" color="$textSubdued">
          Wallet
        </SizableText>
        <SizableText size="$bodyXs" color="$textSubdued">
          Total Taker Fee
        </SizableText>
      </XStack>
      <YStack gap="$1">
        {WALLET_BUILDER_FEES.map((wallet) => {
          const walletTaker = wallet.builderFee + computedFees.hlTaker;
          return (
            <WalletRow
              key={wallet.name}
              name={wallet.name}
              totalTakerFee={walletTaker}
              maxTakerFee={maxTakerFee}
              icon={wallet.icon as number}
              color={wallet.color}
              isHighlighted={wallet.name === 'OneKey'}
            />
          );
        })}
      </YStack>
      <SizableText size="$bodyXs" color="$textSuccess" pt="$1">
        OneKey 0 Builder Fee — lowest fees across all wallets
      </SizableText>
    </YStack>
  );
}

const SEGMENT_OPTIONS = [
  { label: 'Your Fees', value: 'your-fees' },
  { label: 'Compare', value: 'compare' },
];

function PerpFeeTierPopoverContent() {
  const { feeTier, stakingTier, builderFee } = DEMO_USER_FEE_DATA;
  const [activeTab, setActiveTab] = useState<string | number>('your-fees');

  const handleTabChange = useCallback((value: string | number) => {
    setActiveTab(value);
  }, []);

  const computedFees = useMemo(() => {
    const tierData =
      HYPERLIQUID_FEE_TIERS.find((t) => t.tier === feeTier) ??
      HYPERLIQUID_FEE_TIERS[0];
    const stakingData = HYPE_STAKING_TIERS.find(
      (s) => s.tier === stakingTier,
    );
    const stakingDiscount = stakingData?.discount ?? 0;

    const hlTaker = tierData.taker * (1 - stakingDiscount);
    const hlMaker = tierData.maker * (1 - stakingDiscount);
    const totalTaker = builderFee + hlTaker;
    const totalMaker = builderFee + hlMaker;

    return {
      tierData,
      stakingDiscount,
      hlTaker,
      hlMaker,
      totalTaker,
      totalMaker,
    };
  }, [feeTier, stakingTier, builderFee]);

  return (
    <YStack px="$4" pt="$3" pb="$4" gap="$3">
      <SegmentControl
        fullWidth
        value={activeTab}
        options={SEGMENT_OPTIONS}
        onChange={handleTabChange}
      />
      {activeTab === 'your-fees' ? (
        <YourFeesSection
          builderFee={builderFee}
          computedFees={computedFees}
          feeTier={feeTier}
          stakingTier={stakingTier}
        />
      ) : (
        <WalletComparisonSection computedFees={computedFees} />
      )}
    </YStack>
  );
}

function PerpFeeTierPopoverComponent() {
  return (
    <Popover
      title="Fee Tiers"
      placement="top-start"
      floatingPanelProps={{ w: 360 }}
      renderTrigger={
        <XStack
          alignItems="center"
          gap="$1"
          py="$1"
          cursor="pointer"
        >
          <Icon
            name="PercentOutline"
            size="$4"
            color="$iconSubdued"
          />
          <SizableText size="$bodySm" color="$textSubdued">
            Fee Tier
          </SizableText>
        </XStack>
      }
      renderContent={<PerpFeeTierPopoverContent />}
    />
  );
}

export const PerpFeeTierPopover = memo(PerpFeeTierPopoverComponent);
PerpFeeTierPopover.displayName = 'PerpFeeTierPopover';
