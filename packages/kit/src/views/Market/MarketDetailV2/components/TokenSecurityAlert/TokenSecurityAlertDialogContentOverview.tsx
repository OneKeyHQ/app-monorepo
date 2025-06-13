import { memo } from 'react';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentOverviewProps = {
  warningCount: number;
  totalChecks: number;
  loading: boolean;
  error: string | null;
};

function TokenSecurityAlertDialogContentOverview({
  warningCount,
  totalChecks,
  loading,
  error,
}: ITokenSecurityAlertDialogContentOverviewProps) {
  if (loading || error) {
    return null;
  }

  const hasWarnings = warningCount > 0;
  const iconName = hasWarnings ? 'BugOutline' : 'CheckRadioSolid';
  const iconColor = hasWarnings ? '$iconCaution' : '$iconSuccess';
  const textColor = hasWarnings ? '$textCaution' : '$textSuccess';

  return (
    <Stack
      p="$3"
      bg={hasWarnings ? '$bgCaution' : '$bgSuccess'}
      borderRadius="$3"
      borderWidth="$px"
      borderColor={hasWarnings ? '$borderCaution' : '$borderSuccess'}
    >
      <XStack gap="$3" alignItems="center">
        <Icon name={iconName} size="$5" color={iconColor} />

        <Stack flex={1}>
          <SizableText size="$bodyLgMedium" color={textColor}>
            {hasWarnings
              ? `${warningCount} Security Warning${
                  warningCount > 1 ? 's' : ''
                } Found`
              : 'Token Security Verified'}
          </SizableText>

          <SizableText size="$bodySm" color="$textSubdued">
            {totalChecks} security check{totalChecks > 1 ? 's' : ''} completed
          </SizableText>
        </Stack>
      </XStack>
    </Stack>
  );
}

export default memo(TokenSecurityAlertDialogContentOverview);
