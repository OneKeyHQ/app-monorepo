import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

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
  backgroundColor,
}: {
  count: number;
  label: string;
  iconName: IKeyOfIcons;
  iconColor: ColorTokens;
  backgroundColor: ColorTokens;
}) {
  return (
    <XStack width="50%" alignItems="center" gap="$3">
      <Stack
        width={56}
        height={56}
        borderRadius="$full"
        backgroundColor={backgroundColor}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={iconName} size="$8" color={iconColor} />
      </Stack>

      <Stack>
        <SizableText size="$headingXl" color="$text">
          {count}
        </SizableText>

        <SizableText size="$bodyLg" color="$textSubdued">
          {label.includes('{number} ') ? label.replace('{number} ', '') : label}
        </SizableText>
      </Stack>
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
    <XStack py="$3" flexWrap="wrap" justifyContent="space-between">
      {/* Show risks if any */}
      {riskCount > 0 ? (
        <SecurityStatusItem
          count={riskCount}
          label={intl.formatMessage({
            id: ETranslations.dexmarket_security_result_high,
          })}
          iconName="BugOutline"
          iconColor="$iconCritical"
          backgroundColor="$bgCritical"
        />
      ) : null}

      {/* Show cautions if any */}
      {cautionCount > 0 ? (
        <SecurityStatusItem
          count={cautionCount}
          label={intl.formatMessage({
            id: ETranslations.dexmarket_security_result_cautions,
          })}
          iconName="BugOutline"
          iconColor="$iconCaution"
          backgroundColor="$bgCaution"
        />
      ) : null}

      {/* Show safe status when no risks or cautions */}
      {isSafe ? (
        <SecurityStatusItem
          count={0}
          label={intl
            .formatMessage({
              id: ETranslations.dexmarket_details_audit_issue,
            })
            .replace('{amount} ', '')}
          iconName="BugOutline"
          iconColor="$iconSuccess"
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
