import { SizableText, XStack } from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

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
