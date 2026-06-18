import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ColorTokens } from '@onekeyhq/components';
import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { formatKytRiskFactorCategory } from '@onekeyhq/kit/src/utils/kytRiskFactorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

// CJK locales render dates in "年/月/日"-style, so use the localized long date
// format (e.g. 2024年6月19日) to keep the day unit; other locales keep the
// "MMM d, yyyy" presentation.
const CJK_DATE_LOCALES = new Set(['zh-CN', 'zh-HK', 'zh-TW', 'ja-JP', 'ko-KR']);

export function formatRiskCheckDate(
  seconds: number,
  { withTime = false }: { withTime?: boolean } = {},
) {
  if (!seconds) {
    return '-';
  }
  const datePart = CJK_DATE_LOCALES.has(appLocale.getLocale())
    ? 'PPP'
    : 'MMM d, yyyy';
  return formatDate(new Date(seconds * 1000), {
    formatTemplate: withTime ? `${datePart} HH:mm` : datePart,
  });
}

// Risk level → text color. Mirrors the receive-KYT detail page so both surfaces
// share a consistent visual language.
export const LEVEL_TEXT_COLOR: Record<EKytRiskLevel, ColorTokens> = {
  [EKytRiskLevel.None]: '$textSuccess',
  [EKytRiskLevel.Checking]: '$textSubdued',
  [EKytRiskLevel.Failed]: '$textSubdued',
  [EKytRiskLevel.Low]: '$textSuccess',
  [EKytRiskLevel.Moderate]: '$textCaution',
  [EKytRiskLevel.High]: '$textCaution',
  [EKytRiskLevel.Severe]: '$textCritical',
};

// Risk level → badge type, used by recent/history list tags.
export const LEVEL_BADGE_TYPE: Record<EKytRiskLevel, IBadgeType> = {
  [EKytRiskLevel.None]: 'success',
  [EKytRiskLevel.Checking]: 'default',
  [EKytRiskLevel.Failed]: 'default',
  [EKytRiskLevel.Low]: 'success',
  [EKytRiskLevel.Moderate]: 'warning',
  [EKytRiskLevel.High]: 'warning',
  [EKytRiskLevel.Severe]: 'critical',
};

// Short level name shown in the summary card / list tags (None / Low / …).
export const LEVEL_TITLE: Record<EKytRiskLevel, ETranslations> = {
  [EKytRiskLevel.None]: ETranslations.kyt_risk_level_none__title,
  [EKytRiskLevel.Checking]: ETranslations.kyt_risk_level_checking__title,
  [EKytRiskLevel.Failed]: ETranslations.kyt_risk_check_failed__title,
  [EKytRiskLevel.Low]: ETranslations.kyt_risk_level_low__title,
  [EKytRiskLevel.Moderate]: ETranslations.kyt_risk_level_moderate__title,
  [EKytRiskLevel.High]: ETranslations.kyt_risk_level_high__title,
  [EKytRiskLevel.Severe]: ETranslations.kyt_risk_level_severe__title,
};

export function CardRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack px="$4" py="$2.5" ai="center" jc="space-between" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

export function RiskFactorCard({ factor }: { factor: IKytRiskFactor }) {
  const intl = useIntl();
  const rows: { label: string; value: string }[] = [];
  if (factor.entity) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_entity__title,
      }),
      value: factor.entity,
    });
  }
  if (factor.exposureType) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_exposure__title,
      }),
      value: factor.exposureType,
    });
  }
  if (factor.hops !== undefined) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_distance__title,
      }),
      value: intl.formatMessage(
        { id: ETranslations.kyt_risk_factor_distance_hops__msg },
        { count: factor.hops },
      ),
    });
  }
  // Exposure amount and share are shown together on one "Exposure / Share" row.
  const amountText =
    factor.amountUsd !== undefined
      ? `$${new BigNumber(factor.amountUsd).toFormat(2)}`
      : undefined;
  const percentText =
    factor.percent !== undefined
      ? `${new BigNumber(factor.percent).toFixed(2)}%`
      : undefined;
  const exposureShareValue = [amountText, percentText]
    .filter(Boolean)
    .join(' / ');
  if (exposureShareValue) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.address_risk_check_exposure_share__title,
      }),
      value: exposureShareValue,
    });
  }

  return (
    <YStack
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <XStack px="$4" py="$2.5" bg="$bgSubdued">
        <SizableText size="$bodyMdMedium">
          {formatKytRiskFactorCategory({ category: factor.category, intl })}
        </SizableText>
      </XStack>
      {rows.map((row) => (
        <YStack key={row.label}>
          <Divider />
          <CardRow label={row.label}>
            <SizableText size="$bodyMdMedium" textAlign="right">
              {row.value}
            </SizableText>
          </CardRow>
        </YStack>
      ))}
    </YStack>
  );
}
