import { useMemo } from 'react';

import { Alert, Dialog, SizableText, YStack } from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

function DAppRiskyAlert({
  origin,
  urlSecurityInfo,
}: {
  origin: string;
  urlSecurityInfo?: IHostSecurity;
}) {
  const isScamLevel = urlSecurityInfo?.level === 'high';
  const riskStyle = useMemo(() => {
    const defaultStyle = {
      titleTextColor: '$text',
      descTextColor: '$textSubdued',
    };
    if (!urlSecurityInfo?.level) {
      return defaultStyle;
    }
    if (urlSecurityInfo?.level === 'high') {
      return {
        titleTextColor: '$textCritical',
        descTextColor: '$textCriticalStrong',
      };
    }
    if (urlSecurityInfo?.level === 'medium') {
      return {
        titleTextColor: '$textCaution',
        descTextColor: '$textCautionStrong',
      };
    }
    return defaultStyle;
  }, [urlSecurityInfo?.level]);

  const DialogContent = useMemo(
    () => (
      <YStack space="$1">
        <SizableText size="$bodyLgMedium" color={riskStyle.titleTextColor}>
          疑似恶意网站
        </SizableText>
        <SizableText size="$bodyMd" color={riskStyle.descTextColor}>
          恶意的 setApprovalForAll 操作使用户的 ERC-721
          资产暴露给恶意行为者，从而可能导致资产被盗
        </SizableText>
      </YStack>
    ),
    [riskStyle],
  );

  if (!urlSecurityInfo?.alert) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={isScamLevel ? 'critical' : 'warning'}
      title={urlSecurityInfo.alert}
      icon={isScamLevel ? 'ErrorSolid' : 'InfoSquareSolid'}
      action={{
        primary: 'Details',
        onPrimaryPress: () => {
          Dialog.show({
            title: origin,
            renderContent: DialogContent,
            showFooter: false,
          });
        },
      }}
      borderTopWidth={0}
    />
  );
}

export { DAppRiskyAlert };
