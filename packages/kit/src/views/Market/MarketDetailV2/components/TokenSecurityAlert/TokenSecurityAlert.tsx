import type { FC } from 'react';

import { Dialog, IconButton, Stack } from '@onekeyhq/components';

import { TokenSecurityAlertDialogContent } from './TokenSecurityAlertDialogContent';
import { useTokenSecurity } from './useTokenSecurity';

type ITokenSecurityAlertProps = {
  tokenAddress?: string;
  networkId: string;
};

const TokenSecurityAlert: FC<ITokenSecurityAlertProps> = ({
  tokenAddress,
  networkId,
}) => {
  const { securityData, error, loading } = useTokenSecurity({
    tokenAddress,
    networkId,
  });

  const handlePress = () => {
    Dialog.show({
      title: 'Token Security Alert',
      showFooter: false,
      renderContent: (
        <TokenSecurityAlertDialogContent
          securityData={securityData}
          error={error}
          loading={loading}
        />
      ),
    });
  };

  // Don't render if loading or no security data
  if (loading || (!securityData && !error)) {
    return null;
  }

  return (
    <Stack>
      <IconButton
        icon="BugOutline"
        variant="tertiary"
        size="small"
        onPress={handlePress}
      />
    </Stack>
  );
};

export { TokenSecurityAlert };
