import { useMemo } from 'react';

import { Alert, Dialog, SizableText, YStack } from '@onekeyhq/components';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

function DAppRiskyAlert({
  origin,
  urlSecurityInfo,
}: {
  origin: string;
  urlSecurityInfo?: IHostSecurity;
}) {
  const isScamLevel = urlSecurityInfo?.level === EHostSecurityLevel.High;
  const riskStyle = useMemo(() => {
    const defaultStyle = {
      titleTextColor: '$text',
      descTextColor: '$textSubdued',
    };
    if (!urlSecurityInfo?.level) {
      return defaultStyle;
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.High) {
      return {
        titleTextColor: '$textCritical',
        descTextColor: '$textCriticalStrong',
      };
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.Medium) {
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
          {urlSecurityInfo?.detail?.title ?? ''}
        </SizableText>
        <SizableText size="$bodyMd" color={riskStyle.descTextColor}>
          {urlSecurityInfo?.detail?.content ?? ''}
        </SizableText>
      </YStack>
    ),
    [
      riskStyle.descTextColor,
      riskStyle.titleTextColor,
      urlSecurityInfo?.detail,
    ],
  );

  if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={isScamLevel ? 'critical' : 'warning'}
      title={urlSecurityInfo?.alert ?? ''}
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
