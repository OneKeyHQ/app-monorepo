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

import { TokenSecurityAlertDialogContent } from './components';
import { useTokenSecurity } from './hooks';

function TokenSecurityAlert() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();

  const { securityData, securityStatus, warningCount } = useTokenSecurity({
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
          warningCount={warningCount}
        />
      ),
    });
  };

  // Don't render if no security data
  if (!securityData) {
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
