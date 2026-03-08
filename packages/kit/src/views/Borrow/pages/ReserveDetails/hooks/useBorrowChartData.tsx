import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

// Type definitions
export type ITimePeriod = 'week' | 'month' | 'quarter' | 'year';

const SUPPLY_APY_CHART_COLORS_LIGHT = {
  line: '#008647D4',
  top: '#00864726',
  bottom: '#00864700',
} as const;

const SUPPLY_APY_CHART_COLORS_DARK = {
  line: '#43FEA4AB',
  top: '#43FEA426',
  bottom: '#43FEA400',
} as const;

const BORROW_APY_CHART_COLORS = {
  line: '#BF7000A3',
  top: '#BF700026',
  bottom: '#BF700000',
} as const;

const APY_CHART_LINE_WIDTH = 2;

const APY_CHART_COLORS_LIGHT = {
  supply: SUPPLY_APY_CHART_COLORS_LIGHT,
  borrow: BORROW_APY_CHART_COLORS,
  lineWidth: APY_CHART_LINE_WIDTH,
} as const;

const APY_CHART_COLORS_DARK = {
  supply: SUPPLY_APY_CHART_COLORS_DARK,
  borrow: BORROW_APY_CHART_COLORS,
  lineWidth: APY_CHART_LINE_WIDTH,
} as const;

export function useApyChartColors() {
  const themeVariant = useThemeVariant();
  return themeVariant === 'dark'
    ? APY_CHART_COLORS_DARK
    : APY_CHART_COLORS_LIGHT;
}

// Time period options hook
export function useTimePeriodOptions() {
  const intl = useIntl();

  return useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.market_1w }),
        value: 'week' as ITimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1m }),
        value: 'month' as ITimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_3m }),
        value: 'quarter' as ITimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1y }),
        value: 'year' as ITimePeriod,
      },
    ],
    [intl],
  );
}

// APY labels hook
export function useApyLabels() {
  const intl = useIntl();

  const supplyApyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_supply_apy }),
    [intl],
  );

  const borrowApyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_borrow_apy }),
    [intl],
  );

  return { supplyApyLabel, borrowApyLabel };
}

// APY history data hook
interface IUseBorrowApyHistoryParams {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  action: 'supply' | 'borrow';
  timePeriod: ITimePeriod;
}

export function useBorrowApyHistory({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  action,
  timePeriod,
}: IUseBorrowApyHistoryParams) {
  const { result: history = [], isLoading } = usePromiseResult(
    async () => {
      const apyHistoryItems =
        await backgroundApiProxy.serviceStaking.getBorrowApyHistory({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          action,
          days: timePeriod,
        });

      return apyHistoryItems.items ?? [];
    },
    [networkId, provider, marketAddress, reserveAddress, action, timePeriod],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  const latestApy = useMemo(() => {
    const latest = history[history.length - 1];
    return latest?.apy ?? '0';
  }, [history]);

  return { history, isLoading, latestApy };
}

// Badges hook
export function useBorrowBadges(details?: IBorrowReserveDetail): {
  supplyBadge: ReactNode;
  borrowBadge: ReactNode;
} {
  const intl = useIntl();

  const supplyBadge = useMemo(() => {
    if (!details?.supply.canBeCollateral) return null;
    return (
      <Badge badgeType="success" gap="$1.5">
        <Badge.Text>
          {intl.formatMessage({ id: ETranslations.defi_can_be_collateral })}
        </Badge.Text>
        <Icon name="Checkmark2SmallOutline" color="$iconSuccess" size="$4" />
      </Badge>
    );
  }, [details?.supply.canBeCollateral, intl]);

  const borrowBadge = useMemo(() => {
    if (!details?.borrow.canBeBorrowed) return null;
    return (
      <Badge badgeType="success" gap="$1.5">
        <Badge.Text>
          {intl.formatMessage({ id: ETranslations.defi_borrowable })}
        </Badge.Text>
        <Icon name="Checkmark2SmallOutline" color="$iconSuccess" size="$4" />
      </Badge>
    );
  }, [details?.borrow.canBeBorrowed, intl]);

  return { supplyBadge, borrowBadge };
}
