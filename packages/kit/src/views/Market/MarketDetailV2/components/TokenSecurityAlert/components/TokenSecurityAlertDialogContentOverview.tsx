import { memo } from 'react';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';

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
    <XStack gap="$2" alignItems="center">
      <Stack
        width={56}
        height={56}
        borderRadius="$full"
        backgroundColor={backgroundColor}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={iconName as any} size="$5" color={iconColor as any} />
      </Stack>

      <Stack gap="$1" alignItems="center">
        <SizableText
          size="$bodyLgMedium"
          fontWeight="600"
          color={textColor as any}
        >
          {count}
        </SizableText>

        <SizableText
          size="$bodyMdMedium"
          color={textColor as any}
          textAlign="center"
        >
          {label}
        </SizableText>
      </Stack>
    </XStack>
  );
}

function TokenSecurityAlertDialogContentOverviewBase({
  riskCount,
  cautionCount,
}: ITokenSecurityAlertDialogContentOverviewProps) {
  const isSafe = riskCount === 0 && cautionCount === 0;

  return (
    <XStack py="$3" gap="$4" flexWrap="wrap">
      {/* Show risks if any */}
      {riskCount > 0 ? (
        <SecurityStatusItem
          count={riskCount}
          label="High risks"
          iconName="BugOutline"
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
          iconName="BugOutline"
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
    </XStack>
  );
}

const TokenSecurityAlertDialogContentOverview = memo(
  TokenSecurityAlertDialogContentOverviewBase,
);

export { TokenSecurityAlertDialogContentOverview };
