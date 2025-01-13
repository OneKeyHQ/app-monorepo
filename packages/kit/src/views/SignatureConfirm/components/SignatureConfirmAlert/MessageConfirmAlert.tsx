import { memo, useCallback } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IAlertProps } from '@onekeyhq/components';
import { Alert, YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';

interface IProps {
  unsignedMessage: IUnsignedMessage;
  isRiskSignMethod: boolean;
  messageDisplay: ISignatureConfirmDisplay | undefined;
}

function MessageConfirmAlert(props: IProps) {
  const { messageDisplay, unsignedMessage, isRiskSignMethod } = props;
  const intl = useIntl();

  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  const isPermitSignMethod = isPrimaryTypePermitSign({ unsignedMessage });
  const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });

  const renderLocalParsedMessageAlert = useCallback(() => {
    if (isSignTypedDataV3orV4Method) {
      let type: IAlertProps['type'] = 'default';
      let messageType = 'signTypedData';

      if (isPermitSignMethod || isOrderSignMethod) {
        type = 'warning';
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
            type="warning"
            icon="InfoSquareOutline"
          />
        ))}
      </YStack>
    );
  }, [messageDisplay?.alerts, renderLocalParsedMessageAlert]);

  return renderMessageAlerts();
}

export default memo(MessageConfirmAlert);
