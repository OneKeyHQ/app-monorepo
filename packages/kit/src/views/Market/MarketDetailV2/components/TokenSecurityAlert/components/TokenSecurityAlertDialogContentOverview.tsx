import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ITokenSecurityAlertDialogContentOverviewProps = {
  warningCount: number;
};

function TokenSecurityAlertDialogContentOverviewBase({
  warningCount,
}: ITokenSecurityAlertDialogContentOverviewProps) {
  const intl = useIntl();

  const hasWarnings = warningCount > 0;
  const iconName = hasWarnings ? 'BugOutline' : 'CheckRadioSolid';
  const iconColor = hasWarnings ? '$iconCaution' : '$iconSuccess';
  const textColor = hasWarnings ? '$textCaution' : '$textSuccess';

  return (
    <XStack py="$3" gap="$3" alignItems="center">
      <Stack
        width="$12"
        height="$12"
        borderRadius="$full"
        backgroundColor={hasWarnings ? '$bgCaution' : '$bgSuccess'}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={iconName} size="$8" color={iconColor} />
      </Stack>

      <SizableText size="$bodyLgMedium" color={textColor}>
        {intl.formatMessage(
          {
            id: ETranslations.dexmarket_details_audit_issue,
          },
          { amount: warningCount },
        )}
      </SizableText>
    </XStack>
  );
}

const TokenSecurityAlertDialogContentOverview = memo(
  TokenSecurityAlertDialogContentOverviewBase,
);

export { TokenSecurityAlertDialogContentOverview };
