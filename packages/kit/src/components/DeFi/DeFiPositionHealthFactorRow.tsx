import { useIntl } from 'react-intl';

import { Popover, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IHealthFactorRisk = 'critical' | 'warning' | 'success';

// Risk band is a client-side heuristic on the bare health factor. The portfolio
// list only carries the raw number (metrics.healthFactor), not the Borrow
// page's backend-driven risk detail, so we map the number to a risk band here.
// 1.0 is the liquidation threshold; the closer to it, the worse.
// ponytail: fixed thresholds; swap for backend risk bands if the positions API
// ever returns them.
function getHealthFactorRisk(healthFactor: number): IHealthFactorRisk {
  if (healthFactor < 1.2) return 'critical';
  if (healthFactor < 1.5) return 'warning';
  return 'success';
}

// Risk lives on the value itself — a risk-coloured number, the same way other
// numbers in the list render. No pill (that reads as a category tag) and no
// status dot; the number is the signal.
const RISK_TEXT_COLOR: Record<IHealthFactorRisk, ColorTokens> = {
  critical: '$textCritical',
  warning: '$textCaution',
  success: '$textSuccess',
};

export function DeFiPositionHealthFactorRow({
  healthFactor,
}: {
  healthFactor: number;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: ETranslations.defi_health_factor });
  const description = intl.formatMessage({
    id: ETranslations.defi_health_factor__desc,
  });
  const risk = getHealthFactorRisk(healthFactor);
  const displayValue = Number.isFinite(healthFactor)
    ? healthFactor.toFixed(2)
    : '∞';

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
        color={RISK_TEXT_COLOR[risk]}
        fontVariant={TABULAR_NUMS}
        numberOfLines={1}
      >
        {displayValue}
      </SizableText>
    </XStack>
  );
}
