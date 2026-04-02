import { useMemo } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

export function DAppRiskyAlertDetail({
  urlSecurityInfo,
}: {
  urlSecurityInfo?: IHostSecurity;
}) {
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
    if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
      return {
        titleTextColor: '$textSuccess',
        descTextColor: '$textSubdued',
      };
    }
    return defaultStyle;
  }, [urlSecurityInfo?.level]);
  return (
    <YStack gap="$1">
      <SizableText size="$bodyLgMedium" color={riskStyle.titleTextColor}>
        {urlSecurityInfo?.detail?.title ?? ''}
      </SizableText>
      <SizableText size="$bodyMd" color={riskStyle.descTextColor}>
        {urlSecurityInfo?.detail?.content ?? ''}
      </SizableText>
    </YStack>
  );
}
