import { SizableText, XStack } from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

export function formatRiskCheckDate(
  seconds: number,
  { withTime = false }: { withTime?: boolean } = {},
) {
  if (!seconds) {
    return '-';
  }
  return formatDate(new Date(seconds * 1000), {
    hideTimeForever: !withTime,
    hideSeconds: true,
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
