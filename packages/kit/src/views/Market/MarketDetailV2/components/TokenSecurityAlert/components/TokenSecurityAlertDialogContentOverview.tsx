import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ITokenSecurityAlertDialogContentOverviewProps = {
  riskCount: number;
  cautionCount: number;
};

// Component for individual security status item
function SecurityStatusItem({
  count,
  label,
  iconName,
  iconColor,
  textColor,
  backgroundColor,
}: {
  count: number;
  label: string;
  iconName: string;
  iconColor: string;
  textColor: string;
  backgroundColor: string;
}) {
  return (
    <XStack gap="$3" alignItems="center">
      <Stack
        width="$10"
        height="$10"
        borderRadius="$full"
        backgroundColor={backgroundColor}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={iconName as any} size="$6" color={iconColor as any} />
      </Stack>

      <SizableText size="$bodyMdMedium" color={textColor as any}>
        {count} {label}
      </SizableText>
    </XStack>
  );
}

function TokenSecurityAlertDialogContentOverviewBase({
  riskCount,
  cautionCount,
}: ITokenSecurityAlertDialogContentOverviewProps) {
  const intl = useIntl();

  const isSafe = riskCount === 0 && cautionCount === 0;

  return (
    <Stack py="$3" gap="$2">
      {/* Show risks if any */}
      {riskCount > 0 ? (
        <SecurityStatusItem
          count={riskCount}
          label="High risks"
          iconName="ErrorSolid"
          iconColor="$iconCritical"
          textColor="$textCritical"
          backgroundColor="$bgCritical"
        />
      ) : null}

      {/* Show cautions if any */}
      {cautionCount > 0 ? (
        <SecurityStatusItem
          count={cautionCount}
          label="Cautions"
          iconName="InfoCircleSolid"
          iconColor="$iconCaution"
          textColor="$textCaution"
          backgroundColor="$bgCaution"
        />
      ) : null}

      {/* Show safe status when no risks or cautions */}
      {isSafe ? (
        <SecurityStatusItem
          count={0}
          label="Safe"
          iconName="CheckRadioSolid"
          iconColor="$iconSuccess"
          textColor="$textSuccess"
          backgroundColor="$bgSuccess"
        />
      ) : null}
    </Stack>
  );
}

const TokenSecurityAlertDialogContentOverview = memo(
  TokenSecurityAlertDialogContentOverviewBase,
);

export { TokenSecurityAlertDialogContentOverview };
