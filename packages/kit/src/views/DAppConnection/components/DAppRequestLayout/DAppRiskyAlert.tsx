import { useMemo } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Alert,
  Dialog,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components/src/actions/Alert';
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
  const riskStyle = useMemo(() => {
    const defaultStyle = {
      type: 'success',
      alertIcon: 'InfoCircleSolid',
      titleTextColor: '$textSuccess',
      descTextColor: '$textSubdued',
    };
    if (!urlSecurityInfo?.level) {
      return defaultStyle;
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.High) {
      return {
        type: 'critical',
        alertIcon: 'ErrorSolid',
        titleTextColor: '$textCritical',
        descTextColor: '$textCriticalStrong',
      };
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.Medium) {
      return {
        type: 'warning',
        alertIcon: 'InfoSquareSolid',
        titleTextColor: '$textCaution',
        descTextColor: '$textCautionStrong',
      };
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.Unknown) {
      return {
        type: 'default',
        alertIcon: 'InfoCircleSolid',
        titleTextColor: '$text',
        descTextColor: '$textSubdued',
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

  if (!urlSecurityInfo) {
    return <Skeleton w="100%" h={59} />;
  }

  if (!urlSecurityInfo?.alert) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={riskStyle.type as IAlertType}
      title={urlSecurityInfo?.alert ?? ''}
      icon={riskStyle.alertIcon as IKeyOfIcons}
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
