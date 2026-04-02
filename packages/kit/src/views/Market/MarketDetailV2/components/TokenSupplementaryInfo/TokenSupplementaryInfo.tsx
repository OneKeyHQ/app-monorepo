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

const formatCurrencyValue = (value: ISupplyValue, currencySymbol: string) => {
  const formatted = formatSupplyValue(value);
  return formatted === FALLBACK_VALUE
    ? formatted
    : `${currencySymbol}${formatted}`;
};

export function TokenSupplementaryInfo() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();

  const rows = useMemo(() => {
    if (!tokenDetail) {
      return [];
    }

    const circulatingSupply = toSupplyInput(tokenDetail.circulatingSupply);
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
        value: formatCurrencyValue(marketCap, '$'),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_mc_tips,
        }),
      },
      {
        key: 'fdv',
        label: intl.formatMessage({ id: ETranslations.global_fdv }),
        value: formatCurrencyValue(fdv, '$'),
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
    <YStack pl="$3" pr="$5" pt="$3" gap="$2.5">
      {rows.map((item) => (
        <XStack key={item.key} gap="$2" jc="space-between" ai="center">
          <Tooltip
            placement="top"
            renderTrigger={
              <DashText
                size="$bodySm"
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
          <SizableText size="$bodySmMedium" color="$text">
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
