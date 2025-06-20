import { useIntl } from 'react-intl';

import {
  ButtonFrame,
  Dialog,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenSecurityAlertDialogContent } from './TokenSecurityAlertDialogContent';
import { useTokenSecurity } from './useTokenSecurity';

function TokenSecurityAlert() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();

  const { securityData, securityStatus, warningCount, error, loading } =
    useTokenSecurity({
      tokenAddress,
      networkId,
    });

  const handlePress = () => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
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

        {warningCount > 0 ? (
          <SizableText color={color}>{warningCount}</SizableText>
        ) : null}
      </XStack>
    </ButtonFrame>
  );
}

export { TokenSecurityAlert };
