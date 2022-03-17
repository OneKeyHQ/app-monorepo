import React, { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Icon, Modal, Spinner, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';

import {
  DappSendModalRoutes,
  DappSendRoutesParams,
} from '../../routes/Modal/DappSend';

type RouteProps = RouteProp<
  DappSendRoutesParams,
  DappSendModalRoutes.SendConfirmAuthModal
>;

type EnableLocalAuthenticationProps = {
  sendParams: {
    id: number | string;
    accountId: string;
    networkId: string;
    to: string;
    value: string;
    tokenIdOnNetwork?: string;
    gasLimit: string;
    gasPrice: string;
  };
  password: string;
};

enum TransactionStatus {
  Pending,
  Success,
  Failed,
}

const SendConfirmAuth: FC<EnableLocalAuthenticationProps> = ({
  sendParams,
  password,
}) => {
  const intl = useIntl();
  const [status, setStatus] = useState(TransactionStatus.Pending);
  const [errorMsg, setErrorMsg] = useState<string>();
  const [errorKey, setErrorKey] = useState<string>();

  useEffect(() => {
    // Finale
    if (status !== TransactionStatus.Pending) {
      return;
    }

    (async () => {
      try {
        const transferResult = await backgroundApiProxy.engine.transfer(
          password,
          sendParams.networkId,
          sendParams.accountId,
          sendParams.to,
          sendParams.value,
          sendParams.gasPrice,
          sendParams.gasLimit,
          sendParams.tokenIdOnNetwork,
        );
        if (transferResult.success) {
          setStatus(TransactionStatus.Success);

          return backgroundApiProxy.servicePromise.resolveCallback({
            id: sendParams.id,
            data: transferResult.txid,
          });
        }
      } catch (e) {
        const error = e as { key?: string; message?: string };
        setErrorKey(error?.key ?? 'msg__unknown_error');
        setErrorMsg(error?.message);
        setStatus(TransactionStatus.Failed);
      }
    })();
  }, [
    status,
    password,
    sendParams.id,
    sendParams.networkId,
    sendParams.accountId,
    sendParams.to,
    sendParams.value,
    sendParams.gasPrice,
    sendParams.gasLimit,
    sendParams.tokenIdOnNetwork,
  ]);

  const content = useMemo(() => {
    if (status === TransactionStatus.Pending) {
      return null;
    }

    if (status === TransactionStatus.Success) {
      return (
        <Center flex={1}>
          <Center bg="surface-success-default" borderRadius="full" size="56px">
            <Icon name="CheckOutline" color="icon-success" />
          </Center>
          <Typography.DisplayMedium mt={6}>
            {intl.formatMessage({ id: 'transaction__success' })}
          </Typography.DisplayMedium>
        </Center>
      );
    }

    // Error
    const errorText = errorMsg ?? intl.formatMessage({ id: errorKey });
    return (
      <Center flex={1}>
        <Center bg="surface-critical-subdued" borderRadius="full" size="56px">
          <Icon name="ExclamationOutline" color="icon-critical" />
        </Center>
        <Typography.DisplayMedium mt={6}>
          {intl.formatMessage({ id: 'msg__engine__failed_to_transfer' })}
        </Typography.DisplayMedium>
        <Typography.Body1 color="text-subdued" textAlign="center" mt={2}>
          {errorText}
        </Typography.Body1>
      </Center>
    );
  }, [errorKey, errorMsg, intl, status]);

  return (
    <Center h="full" w="full">
      {content || <Spinner size="lg" />}
    </Center>
  );
};

export const HDAccountAuthentication = () => {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const sendParams = {
    id: params.id,
    accountId: params.account.id,
    networkId: params.network.id,
    tokenIdOnNetwork: params.token.idOnNetwork,
    to: params.to,
    value: params.value,
    gasPrice: params.gasPrice,
    gasLimit: params.gasLimit,
  };

  return (
    <Modal footer={null}>
      <Protected>
        {(password) => (
          <SendConfirmAuth sendParams={sendParams} password={password} />
        )}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
