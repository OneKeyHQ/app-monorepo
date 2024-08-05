import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Alert, Dialog, SizableText, YStack } from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components/src/actions/Alert';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  const riskStyle = useMemo(() => {
    const defaultStyle = {
      type: 'default',
      alertIcon: 'InfoCircleSolid',
      titleTextColor: '$text',
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
    if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
      return {
        type: 'success',
        alertIcon: 'InfoCircleSolid',
        titleTextColor: '$textSuccess',
        descTextColor: '$textSubdued',
      };
    }
    return defaultStyle;
  }, [urlSecurityInfo?.level]);

  const DialogContent = useMemo(
    () => (
      <YStack gap="$1">
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

  if (!urlSecurityInfo?.alert) {
    return null;
  }

  if (urlSecurityInfo?.level === EHostSecurityLevel.Unknown) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={riskStyle.type as IAlertType}
      title={urlSecurityInfo?.alert ?? ''}
      icon={riskStyle.alertIcon as IKeyOfIcons}
      action={{
        primary: intl.formatMessage({ id: ETranslations.global_details }),
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
