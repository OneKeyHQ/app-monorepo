import { useIntl } from 'react-intl';

import {
  Badge,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens, IBadgeType } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IHealthFactorRisk = 'critical' | 'warning' | 'success';

// Risk band on the bare health factor. The portfolio list only carries the
// raw number (metrics.healthFactor), not the Borrow page's backend-driven risk
// detail, so the number maps to the bands the backend colors with (read off
// its borrow quotes 10-28: 1.50 and up, 1.10 to 1.49, under 1.10).
// 1.0 is the liquidation threshold; the closer to it, the worse.
function getHealthFactorRisk(healthFactor: number): IHealthFactorRisk {
  if (healthFactor < 1.1) return 'critical';
  if (healthFactor < 1.5) return 'warning';
  return 'success';
}

// Risk lives on the value itself — a risk-coloured number, the same way other
// numbers in the list render; no status dot. Where the page has the Borrow
// page's own reading, its status word follows as that page shows it.
const RISK_TEXT_COLOR: Record<IHealthFactorRisk, ColorTokens> = {
  critical: '$textCritical',
  warning: '$textCaution',
  success: '$textSuccess',
};

export function DeFiPositionHealthFactorRow({
  healthFactor,
  valueText,
  valueColor,
  status,
}: {
  healthFactor: number;
  /** The figure as the Borrow page words it, where a page has its reading */
  valueText?: string;
  /** A page that reads the risk its own way colors the value itself */
  valueColor?: string;
  /** The Borrow page's status for the position, where a page has it */
  status?: { tag: string; badge: IBadgeType };
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: ETranslations.defi_health_factor });
  const description = intl.formatMessage({
    id: ETranslations.defi_health_factor__desc,
  });
  const risk = getHealthFactorRisk(healthFactor);
  let displayValue = '∞';
  if (valueText) {
    displayValue = valueText;
  } else if (Number.isFinite(healthFactor)) {
    displayValue = healthFactor.toFixed(2);
  }

  return (
    <XStack ai="center" gap="$2" alignSelf="flex-start" minWidth={0}>
      {/* Dashed-underline label is the info affordance (mirrors the Perp
          tables), replacing a standalone icon. Popover — not Tooltip — because
          Tooltip renders trigger-only on native, so a touch user could never
          open the explainer. Click/press only, no hover cue. */}
      <Popover
        placement="top"
        title={label}
        renderTrigger={
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            borderBottomWidth="$px"
            borderTopWidth={0}
            borderLeftWidth={0}
            borderRightWidth={0}
            borderBottomColor="$borderStrong"
            borderStyle="dashed"
            cursor="pointer"
            numberOfLines={1}
          >
            {label}
          </SizableText>
        }
        renderContent={
          <YStack p="$4">
            <SizableText size="$bodyMd" color="$text">
              {description}
            </SizableText>
          </YStack>
        }
      />
      <SizableText
        size="$bodyMdMedium"
        color={valueColor ?? RISK_TEXT_COLOR[risk]}
        fontVariant={TABULAR_NUMS}
        numberOfLines={1}
      >
        {displayValue}
      </SizableText>
      {status?.tag ? (
        <Badge badgeType={status.badge}>{status.tag}</Badge>
      ) : null}
    </XStack>
  );
}
