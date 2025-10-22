import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';

const FALLBACK_VALUE = '--';

type ISupplyValue = string | number | null | undefined;

const toSupplyInput = (value: unknown): ISupplyValue => {
  console.log('value', value);

  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return undefined;
};

const formatSupplyValue = (
  value: ISupplyValue,
  fallback: string = FALLBACK_VALUE,
) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const formatted = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(String(value)),
  );
  return typeof formatted === 'string' ? formatted : String(formatted);
};

const formatCurrencyValue = (value: ISupplyValue) => {
  const formatted = formatSupplyValue(value);
  return formatted === FALLBACK_VALUE ? formatted : `$${formatted}`;
};

export function TokenSupplementaryInfo() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();

  const rows = useMemo(() => {
    if (!tokenDetail) {
      return [];
    }

    // Note: circulatingSupply and maxSupply are not available in IMarketTokenDetail
    // Using fdv and marketCap as alternatives (similar to mobile TokenOverview)
    const circulatingSupply = toSupplyInput(
      tokenDetail.fdv || tokenDetail.marketCap,
    );
    const marketCap = toSupplyInput(tokenDetail.marketCap);
    const fdv = toSupplyInput(tokenDetail.fdv);

    return [
      {
        key: 'circulating',
        label: intl.formatMessage({
          id: ETranslations.global_circulating_supply,
        }),
        value: formatSupplyValue(circulatingSupply),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_circulating_supply_tips,
        }),
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({
          id: ETranslations.dexmarket_market_cap,
        }),
        value: formatCurrencyValue(marketCap),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_mc_tips,
        }),
      },
      {
        key: 'fdv',
        label: intl.formatMessage({ id: ETranslations.global_fdv }),
        value: formatCurrencyValue(fdv),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_fdv_desc,
        }),
      },
    ];
  }, [intl, tokenDetail]);

  if (!tokenDetail) {
    return null;
  }

  return (
    <YStack p="$5">
      {rows.map((item) => (
        <XStack key={item.key} py="$2" gap="$2" jc="space-between" ai="center">
          <Tooltip
            placement="top"
            renderTrigger={
              <DashText
                size="$bodyMd"
                color="$textSubdued"
                dashColor="$textDisabled"
                dashThickness={0.5}
                cursor="help"
              >
                {item.label}
              </DashText>
            }
            renderContent={
              <SizableText size="$bodySm">{item.tooltip}</SizableText>
            }
          />
          <SizableText size="$bodyMdMedium" color="$text">
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
