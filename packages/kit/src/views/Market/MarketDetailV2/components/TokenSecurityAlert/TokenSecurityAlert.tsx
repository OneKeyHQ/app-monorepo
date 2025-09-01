import { useIntl } from 'react-intl';

import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import { NATIVE_HIT_SLOP } from '@onekeyhq/components/src/utils';
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

  // Always execute the status check, but don't render UI if no security data
  if (!securityData) {
    return null;
  }

  const color = securityStatus === 'warning' ? '$iconCaution' : '$iconSuccess';

  return (
    <XStack
      cursor="pointer"
      onPress={handlePress}
      ai="center"
      gap="$0.5"
      hitSlop={NATIVE_HIT_SLOP}
    >
      <Icon name="BugOutline" size="$4" color={color} />
      <SizableText size="$bodySmMedium" color={color}>
        {warningCount}
      </SizableText>
    </XStack>
  );
}

export { TokenSecurityAlert };
