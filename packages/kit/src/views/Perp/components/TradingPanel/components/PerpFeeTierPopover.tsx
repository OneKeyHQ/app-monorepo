import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  Illustration,
  Popover,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IHyperliquidUserFeesResponse } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { formatPerpsCompactUsd } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  DEFAULT_HL_MAKER_FEE_FOR_COMPARE,
  DEFAULT_HL_TAKER_FEE_FOR_COMPARE,
  formatFeePercent,
  getStakingTierLabelByDiscount,
  normalizePerpsConfigBuilderFeeRate,
} from './feeTierData';

type IResolvedFeeInfo = {
  builderFee: number;
  hlTaker: number;
  hlMaker: number;
  totalTaker: number;
  totalMaker: number;
  feeTierDisplay: string;
  stakingTierDisplay: string;
  isSample: boolean;
};

function toNumber(value: string | number | null | undefined): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resolveFeeTierDisplayFromUserFees(
  userFees: IHyperliquidUserFeesResponse,
) {
  const vipTiers = userFees.feeSchedule?.tiers?.vip ?? [];
  const volume14d = (userFees.dailyUserVlm ?? []).reduce((sum, item) => {
    return sum + toNumber(item.userCross) + toNumber(item.userAdd);
  }, 0);

  let tier = 0;
  let tierLabel = '$0';
  vipTiers.forEach((vipTier, index) => {
    const cutoff = toNumber(vipTier.ntlCutoff);
    if (volume14d >= cutoff) {
      tier = index + 1;
      tierLabel = `>${formatPerpsCompactUsd(cutoff)}`;
    }
  });

  return `Fee Tier ${tier} (${tierLabel})`;
}

function FeeRow({
  label,
  value,
  bold,
  emphasis,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  emphasis?: boolean;
  valueColor?: string;
}) {
  let labelSize: ISizableTextProps['size'] = '$bodySm';
  if (bold) {
    labelSize = '$bodyMdMedium';
  } else if (emphasis) {
    labelSize = '$bodyMd';
  }

  let valueSize: ISizableTextProps['size'] = '$bodySm';
  if (bold || emphasis) {
    valueSize = '$bodyMdMedium';
  }

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size={labelSize} color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size={valueSize}
        color={valueColor ?? (bold ? '$text' : '$textSubdued')}
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function YourFeesSection({
  hasAccount,
  isLoading,
  errorMessage,
  onRetry,
  resolvedFeeInfo,
  isUsingRealData,
  zeroFeeDescription,
}: {
  hasAccount: boolean;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
  resolvedFeeInfo: IResolvedFeeInfo;
  isUsingRealData: boolean;
  zeroFeeDescription: string;
}) {
  const intl = useIntl();
  const builderFeeLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers_fee_builder,
  });
  const takerFeeLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers_taker_fees,
  });
  const makerFeeLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers_maker_fees,
  });
  const totalTakerFeeLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers_total_taker_fee,
  });
  const totalMakerFeeLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers_total_maker_fee,
  });
  const oneKeyBuilderFeeLabel = `OneKey ${builderFeeLabel}`;
  const hlTakerFeeLabel = `Hyperliquid ${takerFeeLabel}`;
  const hlMakerFeeLabel = `Hyperliquid ${makerFeeLabel}`;

  if (!hasAccount) {
    return (
      <YStack gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          Connect account to view real-time fee rates from Hyperliquid userFees.
        </SizableText>
      </YStack>
    );
  }

  if (isLoading && !isUsingRealData) {
    return (
      <XStack
        minHeight={220}
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <Spinner size="small" />
      </XStack>
    );
  }

  if (errorMessage && !isUsingRealData) {
    return (
      <YStack gap="$3" alignItems="center" py="$2">
        <Illustration name="GlobeError" size={88} />
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          Failed to fetch fees. Please try again.
        </SizableText>
        <Button size="small" onPress={onRetry}>
          Retry
        </Button>
      </YStack>
    );
  }

  return (
    <YStack gap="$2.5">
      {errorMessage ? (
        <SizableText size="$bodyXs" color="$textWarning">
          Latest refresh failed. Showing last available/safe fallback data.
        </SizableText>
      ) : null}
      <YStack gap="$2.5">
        <FeeRow
          label={oneKeyBuilderFeeLabel}
          value={formatFeePercent(resolvedFeeInfo.builderFee)}
          emphasis
          valueColor="$green11"
        />
        <FeeRow
          label={hlTakerFeeLabel}
          value={formatFeePercent(resolvedFeeInfo.hlTaker)}
          emphasis
          valueColor="$text"
        />
        <FeeRow
          label={hlMakerFeeLabel}
          value={formatFeePercent(resolvedFeeInfo.hlMaker)}
          emphasis
          valueColor="$text"
        />
      </YStack>
      <Stack h={1} bg="$borderSubdued" />
      <YStack gap="$2.5">
        <FeeRow
          label={totalTakerFeeLabel}
          value={formatFeePercent(resolvedFeeInfo.totalTaker)}
          bold
          valueColor="$green11"
        />
        <FeeRow
          label={totalMakerFeeLabel}
          value={formatFeePercent(resolvedFeeInfo.totalMaker)}
          bold
          valueColor="$green11"
        />
      </YStack>
      <SizableText mt="$1.5" size="$bodySm" color="$textSubdued">
        {zeroFeeDescription}
      </SizableText>
    </YStack>
  );
}

export function PerpFeeTierPopoverContent({
  isDialog = false,
}: {
  isDialog?: boolean;
} = {}) {
  const intl = useIntl();
  const [retryCount, setRetryCount] = useState(0);
  const [userFees, setUserFees] = useState<IHyperliquidUserFeesResponse>();
  const [isLoadingUserFees, setIsLoadingUserFees] = useState(false);
  const [userFeesErrorMessage, setUserFeesErrorMessage] = useState<string>();
  const [onekeyBuilderFee, setOnekeyBuilderFee] = useState(0);
  const [activeAccount] = usePerpsActiveAccountAtom();
  const accountAddress = activeAccount?.accountAddress;
  const hasAccount = Boolean(accountAddress);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        if (cancelled) {
          return;
        }
        setOnekeyBuilderFee(normalizePerpsConfigBuilderFeeRate(fee));
      })
      .catch(() => {
        if (!cancelled) {
          setOnekeyBuilderFee(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
    let cancelled = false;
    if (!accountAddress) {
      setUserFees(undefined);
      setUserFeesErrorMessage(undefined);
      setIsLoadingUserFees(false);
      return;
    }

    setIsLoadingUserFees(true);
    setUserFeesErrorMessage(undefined);

    void backgroundApiProxy.serviceWebviewPerp
      .getUserFees({ userAddress: accountAddress })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setUserFees(data);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const msg = error instanceof Error ? error.message : 'Unknown error';
        setUserFeesErrorMessage(msg);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingUserFees(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountAddress, retryCount]);

  const resolvedFeeInfo = useMemo<IResolvedFeeInfo>(() => {
    if (!userFees) {
      return {
        builderFee: onekeyBuilderFee,
        hlTaker: DEFAULT_HL_TAKER_FEE_FOR_COMPARE,
        hlMaker: DEFAULT_HL_MAKER_FEE_FOR_COMPARE,
        totalTaker: DEFAULT_HL_TAKER_FEE_FOR_COMPARE + onekeyBuilderFee,
        totalMaker: DEFAULT_HL_MAKER_FEE_FOR_COMPARE + onekeyBuilderFee,
        feeTierDisplay: 'Fee Tier 0 ($0)',
        stakingTierDisplay: 'None Staking (0% off)',
        isSample: true,
      };
    }

    const builderFee = onekeyBuilderFee;
    const hlTaker = toNumber(userFees.userCrossRate);
    const hlMaker = toNumber(userFees.userAddRate);
    const totalTaker = hlTaker + builderFee;
    const totalMaker = hlMaker + builderFee;

    const feeTierDisplay = resolveFeeTierDisplayFromUserFees(userFees);
    const stakingDiscount = toNumber(userFees.activeStakingDiscount?.discount);
    const stakingTierLabel = getStakingTierLabelByDiscount(stakingDiscount);
    const stakingTierDisplay = `${stakingTierLabel} Staking (${Math.round(stakingDiscount * 100)}% off)`;

    return {
      builderFee,
      hlTaker,
      hlMaker,
      totalTaker,
      totalMaker,
      feeTierDisplay,
      stakingTierDisplay,
      isSample: false,
    };
  }, [onekeyBuilderFee, userFees]);

  const zeroFeeDescription = useMemo(
    () => intl.formatMessage({ id: ETranslations.perps_fee_desc }),
    [intl],
  );

  return (
    <YStack
      px={isDialog ? '$0' : '$4'}
      pt={isDialog ? '$0' : '$3'}
      pb={isDialog ? '$0' : '$4'}
      gap="$3"
    >
      <YourFeesSection
        hasAccount={hasAccount}
        isLoading={isLoadingUserFees}
        errorMessage={userFeesErrorMessage}
        onRetry={handleRetry}
        resolvedFeeInfo={resolvedFeeInfo}
        isUsingRealData={!resolvedFeeInfo.isSample}
        zeroFeeDescription={zeroFeeDescription}
      />
    </YStack>
  );
}

function PerpFeeTierPopoverComponent() {
  const intl = useIntl();
  const feeTiersLabel = intl.formatMessage({
    id: ETranslations.perps_fee_tiers,
  });

  return (
    <Popover
      title={feeTiersLabel}
      placement="bottom-end"
      floatingPanelProps={{ w: 400 }}
      renderTrigger={
        <XStack alignItems="center" gap="$1" py="$1" cursor="pointer">
          <Icon name="PercentOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodySm" color="$textSubdued">
            {feeTiersLabel}
          </SizableText>
        </XStack>
      }
      renderContent={<PerpFeeTierPopoverContent />}
    />
  );
}

export const PerpFeeTierPopover = memo(PerpFeeTierPopoverComponent);
PerpFeeTierPopover.displayName = 'PerpFeeTierPopover';

export function showPerpFeeTierDialog() {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.perps_fee_tiers }),

    floatingPanelProps: {
      width: 400,
    },
    renderContent: <PerpFeeTierPopoverContent isDialog />,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });
  return dialogInstance;
}
