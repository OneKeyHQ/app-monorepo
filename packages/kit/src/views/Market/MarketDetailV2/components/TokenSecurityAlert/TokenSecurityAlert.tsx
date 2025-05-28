import type { FC } from 'react';

import { Dialog, IconButton, Stack } from '@onekeyhq/components';

import { TokenSecurityAlertDialogContent } from './TokenSecurityAlertDialogContent';

type ITokenSecurityAlertProps = {
  tokenAddress?: string;
  networkId: string;
};

const TokenSecurityAlert: FC<ITokenSecurityAlertProps> = ({
  tokenAddress,
  networkId,
}) => {
  const handlePress = () => {
    Dialog.show({
      title: 'Token Security Alert',
      showFooter: false,
      renderContent: (
        <TokenSecurityAlertDialogContent
          tokenAddress={tokenAddress}
          networkId={networkId}
        />
      ),
    });
  };

  return (
    <Stack>
      <IconButton
        icon="ShieldExclamationOutline"
        variant="tertiary"
        size="small"
        onPress={handlePress}
      />
    </Stack>
  );
};

export { TokenSecurityAlert };
