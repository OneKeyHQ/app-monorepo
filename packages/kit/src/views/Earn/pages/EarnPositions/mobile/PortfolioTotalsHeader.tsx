import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function TotalCell({ label, value }: { label: string; value: string }) {
  const currencyInfo = useCurrency();
  return (
    <YStack flex={1} gap="$1" minWidth={0}>
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <NumberSizeableText
        size="$heading2xl"
        formatter="value"
        formatterOptions={{ currency: currencyInfo.symbol }}
        numberOfLines={1}
      >
        {value}
      </NumberSizeableText>
    </YStack>
  );
}

/**
 * The two figures at the top of the page: what the user holds in OneKey DeFi
 * and what is owed to them (claimable + pending), plus the scope footnote.
 */
export function PortfolioTotalsHeader({
  defiAssetsFiatValue,
  rewardsFiatValue,
}: {
  defiAssetsFiatValue: string;
  rewardsFiatValue: string;
}) {
  const intl = useIntl();
  return (
    <YStack px="$5" pt="$2" pb="$4" gap="$3">
      <XStack gap="$4">
        <TotalCell
          label={intl.formatMessage({
            id: ETranslations.earn_defi_assets__title,
          })}
          value={defiAssetsFiatValue}
        />
        <TotalCell
          label={intl.formatMessage({ id: ETranslations.earn_rewards })}
          value={rewardsFiatValue}
        />
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.earn_defi_scope_note__desc })}
      </SizableText>
    </YStack>
  );
}
