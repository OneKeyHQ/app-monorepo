import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { DashText, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBorrowEModeStatus,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useBorrowContext } from '../BorrowProvider';

import { BorrowBonusMetric } from './BorrowBonusMetric';
import { BorrowEModeMetric } from './BorrowEModeMetric';
import { BorrowRewardsMetric } from './BorrowRewardsMetric';
import { OverviewMetric } from './OverviewMetric';

import type { IBorrowOverviewData } from '../hooks/useBorrowOverviewData';

type IApyWithTooltip = { title: IEarnText; tooltip?: IEarnTooltip };

function ApyDetail({ apy }: { apy?: IApyWithTooltip }) {
  if (!apy?.title) {
    return null;
  }

  const color = apy.title.color ?? '$textSubdued';
  const size = apy.title.size ?? '$bodyMd';

  if (!apy.tooltip) {
    return (
      <SizableText size={size} color={color}>
        {apy.title.text}
      </SizableText>
    );
  }

  return (
    <EarnTooltip
      tooltip={apy.tooltip}
      renderTrigger={
        <DashText size={size} color={color} dashColor={color} dashThickness={1}>
          {apy.title.text}
        </DashText>
      }
    />
  );
}

function BalanceMetric({
  label,
  balance,
  apy,
  isLoading,
}: {
  label: string;
  balance?: { title: IEarnText };
  apy?: IApyWithTooltip;
  isLoading?: boolean;
}) {
  if (!balance?.title && !isLoading) {
    return null;
  }
  return (
    <OverviewMetric
      title={{ text: label }}
      text={balance?.title}
      action={isLoading ? undefined : <ApyDetail apy={apy} />}
      isLoading={isLoading}
      valueLayout="stacked"
    />
  );
}

export function BorrowMobileSummary({
  eModeStatus,
  isEModeLoading = false,
  isEModeError = false,
  overviewData,
  showPositionTotals = true,
  isPositionTotalsLoading = false,
}: {
  eModeStatus?: IBorrowEModeStatus | null;
  isEModeLoading?: boolean;
  isEModeError?: boolean;
  overviewData: IBorrowOverviewData;
  showPositionTotals?: boolean;
  isPositionTotalsLoading?: boolean;
}) {
  const intl = useIntl();
  const { reserves } = useBorrowContext();
  const { borrowRewards, isRewardsLoading, requestRefresh } = overviewData;

  const supplied = reserves.data?.supplied;
  const borrowed = reserves.data?.borrowed;

  return (
    <YStack
      pt="$4"
      gap="$2"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <XStack flexWrap="wrap" mx="$-3" pl="$4">
        {showPositionTotals || isPositionTotalsLoading ? (
          <>
            <BalanceMetric
              label={intl.formatMessage({
                id: ETranslations.defi_supplied_balance,
              })}
              balance={supplied?.suppliedBalance}
              apy={supplied?.suppliedApy}
              isLoading={isPositionTotalsLoading}
            />
            <BalanceMetric
              label={intl.formatMessage({
                id: ETranslations.defi_borrowed_balance,
              })}
              balance={borrowed?.borrowedBalance}
              apy={borrowed?.borrowedApy}
              isLoading={isPositionTotalsLoading}
            />
          </>
        ) : null}
        <BorrowBonusMetric />
        <BorrowRewardsMetric
          borrowRewards={borrowRewards}
          isLoading={isRewardsLoading}
          onClaimed={requestRefresh}
        />
      </XStack>
      <BorrowEModeMetric
        eModeStatus={eModeStatus}
        isLoading={isEModeLoading}
        isError={isEModeError}
        variant="bar"
      />
    </YStack>
  );
}
