import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ITokenSecurityAlertDialogContentOverviewProps = {
  warningCount: number;
  loading: boolean;
  error: string | null;
};

function TokenSecurityAlertDialogContentOverviewBase({
  warningCount,
  loading,
  error,
}: ITokenSecurityAlertDialogContentOverviewProps) {
  const intl = useIntl();

  if (loading || error) {
    return null;
  }

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
        backgroundColor={
          hasWarnings ? '$bgCautionSubdued' : '$bgSuccessSubdued'
        }
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
