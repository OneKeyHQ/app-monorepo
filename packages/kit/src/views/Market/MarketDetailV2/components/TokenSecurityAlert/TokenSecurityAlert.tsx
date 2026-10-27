import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { NATIVE_HIT_SLOP } from '@onekeyhq/components/src/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenSecurityAlertDialogContent } from './components';
import { useTokenSecurity } from './hooks';
import { getTotalSecurityDisplayInfo } from './utils/utils';

function TokenSecurityAlert({
  showLeadingDivider = false,
  variant = 'default',
}: {
  showLeadingDivider?: boolean;
  variant?: 'default' | 'overview';
}) {
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
      sheetDragArea: 'header',
      testID: 'market-token-security-dialog',
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

  if (variant === 'overview') {
    return (
      <XStack
        testID="market-token-security-overview"
        onPress={handlePress}
        cursor="pointer"
        ai="center"
        gap="$1"
        px="$2"
        py="$2"
        bg="$bgStrong"
        borderRadius="$full"
      >
        <Icon name="BugOutline" size="$4" color={color} />
        <SizableText size="$bodySmMedium" color="$text">
          {intl.formatMessage({ id: ETranslations.dexmarket_audit })}
        </SizableText>
        <SizableText size="$bodySmMedium" color="$text">
          {count}
        </SizableText>
      </XStack>
    );
  }

  return (
    <>
      {showLeadingDivider ? (
        <Divider vertical backgroundColor="$borderSubdued" h="$3" />
      ) : null}
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
    </>
  );
}

export { TokenSecurityAlert };
