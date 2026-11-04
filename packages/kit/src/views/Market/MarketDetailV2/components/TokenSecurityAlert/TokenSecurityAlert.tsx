import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Dialog,
  Divider,
  Icon,
  SizableText,
  Stack,
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
  // `badge`: the mobile price header. `overview`: the mobile overview links.
  variant?: 'default' | 'badge' | 'overview';
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

  const label = `${intl.formatMessage({
    id: ETranslations.dexmarket_audit,
  })} ${count}`;

  if (variant === 'badge') {
    return (
      <Badge
        testID="market-token-security-badge"
        badgeType="default"
        badgeSize="sm"
        px="$2"
        py="$1"
        gap="$1.5"
        borderRadius="$full"
        cursor="pointer"
        hitSlop={NATIVE_HIT_SLOP}
        onPress={handlePress}
      >
        {/* A 12px slot the 16px glyph overhangs evenly, as the badge's
            leading icon does in the design. */}
        <Stack w="$3" h="$4" ai="center" jc="center">
          <Icon name="BugOutline" size="$4" color={color} />
        </Stack>
        <Badge.Text size="$bodySm" color="$textSubdued">
          {label}
        </Badge.Text>
      </Badge>
    );
  }

  if (variant === 'overview') {
    return (
      <Button
        testID="market-token-security-overview"
        size="small"
        variant="secondary"
        icon="BugOutline"
        iconColor={color}
        color="$textSubdued"
        onPress={handlePress}
      >
        {label}
      </Button>
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
