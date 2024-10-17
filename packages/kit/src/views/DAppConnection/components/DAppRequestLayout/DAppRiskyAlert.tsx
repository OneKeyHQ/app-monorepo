import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Alert, Dialog } from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components/src/actions/Alert';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlertDetail } from './DAppRiskyAlertDetail';

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
    };
    if (!urlSecurityInfo?.level) {
      return defaultStyle;
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.High) {
      return {
        type: 'critical',
        alertIcon: 'ErrorSolid',
      };
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.Medium) {
      return {
        type: 'warning',
        alertIcon: 'InfoSquareSolid',
      };
    }
    if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
      return {
        type: 'success',
        alertIcon: 'InfoCircleSolid',
      };
    }
    return defaultStyle;
  }, [urlSecurityInfo?.level]);

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
      action={
        urlSecurityInfo?.detail
          ? {
              primary: intl.formatMessage({ id: ETranslations.global_details }),
              onPrimaryPress: () => {
                Dialog.show({
                  title: origin,
                  renderContent: (
                    <DAppRiskyAlertDetail urlSecurityInfo={urlSecurityInfo} />
                  ),
                  showFooter: false,
                });
              },
            }
          : undefined
      }
      borderTopWidth={0}
    />
  );
}

export { DAppRiskyAlert };
