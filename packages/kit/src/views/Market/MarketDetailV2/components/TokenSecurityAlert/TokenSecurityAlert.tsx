import {
  ButtonFrame,
  Dialog,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';

import { TokenSecurityAlertDialogContent } from './TokenSecurityAlertDialogContent';
import { useTokenSecurity } from './useTokenSecurity';

type ITokenSecurityAlertProps = {
  tokenAddress?: string;
  networkId: string;
};

function TokenSecurityAlert({
  tokenAddress,
  networkId,
}: ITokenSecurityAlertProps) {
  const { securityData, securityStatus, warningCount, error, loading } =
    useTokenSecurity({
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

  const color = securityStatus === 'warning' ? '$iconCaution' : '$iconSuccess';

  return (
    <ButtonFrame bg="$transparent" borderWidth={0} onPress={handlePress}>
      <XStack gap="$0.5">
        <Icon name="BugOutline" size={12} color={color} />

        <SizableText color={color}>{warningCount}</SizableText>
      </XStack>
    </ButtonFrame>
  );
}

export { TokenSecurityAlert };
