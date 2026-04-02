import { useIntl } from 'react-intl';

import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import { NATIVE_HIT_SLOP } from '@onekeyhq/components/src/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenSecurityAlertDialogContent } from './components';
import { useTokenSecurity } from './hooks';
import { getTotalSecurityDisplayInfo } from './utils/utils';

function TokenSecurityAlert() {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();

  const { securityData, securityStatus, riskCount, cautionCount } =
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
          riskCount={riskCount}
          cautionCount={cautionCount}
        />
      ),
    });
    // Dex analytics
    if (networkId && tokenAddress && tokenDetail) {
      defaultLogger.dex.actions.dexCheckRisk({
        network: networkId,
        tokenSymbol: tokenDetail.symbol || '',
        tokenContract: tokenAddress,
      });
    }
  };

  // Always execute the status check, but don't render UI if no security data
  if (!securityData) {
    return null;
  }

  const { count, color } = getTotalSecurityDisplayInfo(
    securityStatus,
    riskCount,
    cautionCount,
  );

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
        {count}
      </SizableText>
    </XStack>
  );
}

export { TokenSecurityAlert };
