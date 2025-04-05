import { memo, useCallback, useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IAlertProps } from '@onekeyhq/components';
import { Alert, YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';

interface IProps {
  unsignedMessage: IUnsignedMessage;
  isRiskSignMethod: boolean;
  messageDisplay: ISignatureConfirmDisplay | undefined;

  // temporary props
  walletInternalSign?: boolean;
  urlSecurityInfo?: IHostSecurity;
  isConfirmationRequired?: boolean;
  showContinueOperateLocal?: boolean;
}

function MessageConfirmAlert(props: IProps) {
  const {
    messageDisplay,
    unsignedMessage,
    isRiskSignMethod,

    // temporary props
    walletInternalSign,
    urlSecurityInfo,
    isConfirmationRequired,
    showContinueOperateLocal,
  } = props;

  const intl = useIntl();
  const [devSettings] = useDevSettingsPersistAtom();
  const isStrictSignatureAlert = devSettings.settings?.strictSignatureAlert;

  const showTakeRiskAlert = useMemo(() => {
    if (!isStrictSignatureAlert) {
      return false;
    }

    if (walletInternalSign) {
      return false;
    }

    if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
      return false;
    }

    if (isConfirmationRequired) {
      return true;
    }

    if (!isEmpty(messageDisplay?.alerts)) {
      return true;
    }

    if (showContinueOperateLocal) {
      return true;
    }

    return false;
  }, [
    isStrictSignatureAlert,
    messageDisplay?.alerts,
    showContinueOperateLocal,
    urlSecurityInfo?.level,
    walletInternalSign,
    isConfirmationRequired,
  ]);

  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  const isPermitSignMethod = isPrimaryTypePermitSign({ unsignedMessage });
  const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });

  const renderLocalParsedMessageAlert = useCallback(() => {
    if (isSignTypedDataV3orV4Method) {
      let type: IAlertProps['type'] = showTakeRiskAlert ? 'danger' : 'default';
      let messageType = 'signTypedData';

      if (isPermitSignMethod || isOrderSignMethod) {
        type = showTakeRiskAlert ? 'danger' : 'warning';
        messageType = isPermitSignMethod ? 'permit' : 'order';
      }

      return (
        <Alert
          title={intl.formatMessage(
            {
              id: ETranslations.dapp_connect_permit_sign_alert,
            },
            { type: messageType },
          )}
          type={type}
          icon="InfoSquareSolid"
        />
      );
    }

    if (isRiskSignMethod) {
      return (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.dapp_connect_risk_sign,
          })}
          icon="ErrorSolid"
        />
      );
    }

    return null;
  }, [
    isRiskSignMethod,
    isSignTypedDataV3orV4Method,
    isPermitSignMethod,
    isOrderSignMethod,
    intl,
    showTakeRiskAlert,
  ]);

  const renderMessageAlerts = useCallback(() => {
    const alerts = messageDisplay?.alerts ?? [];
    if (isEmpty(alerts)) {
      return renderLocalParsedMessageAlert();
    }

    return (
      <YStack gap="$2.5">
        {alerts.map((alert) => (
          <Alert
            key={alert}
            description={alert}
            type={showTakeRiskAlert ? 'danger' : 'warning'}
            icon="InfoSquareOutline"
          />
        ))}
      </YStack>
    );
  }, [
    messageDisplay?.alerts,
    renderLocalParsedMessageAlert,
    showTakeRiskAlert,
  ]);

  return renderMessageAlerts();
}

export default memo(MessageConfirmAlert);
