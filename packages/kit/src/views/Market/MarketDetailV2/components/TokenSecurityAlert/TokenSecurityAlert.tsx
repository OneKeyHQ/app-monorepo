import { useIntl } from 'react-intl';

import {
  Button,
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

  const { securityData, securityStatus, warningCount, shouldHide } =
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
          warningCount={warningCount}
        />
      ),
    });
  };

  // Don't render if no security data or if should be hidden due to trust_list being false
  if (!securityData || shouldHide) {
    return null;
  }

  const color = securityStatus === 'warning' ? '$iconCaution' : '$iconSuccess';

  return (
    <Button
      variant="tertiary"
      bg="$transparent"
      borderWidth={0}
      onPress={handlePress}
    >
      <XStack gap="$0.5" ai="center">
        <Icon name="BugOutline" size="$4" color={color} />

        {warningCount > 0 ? (
          <SizableText size="$bodySmMedium" color={color}>
            {warningCount}
          </SizableText>
        ) : null}
      </XStack>
    </Button>
  );
}

export { TokenSecurityAlert };
