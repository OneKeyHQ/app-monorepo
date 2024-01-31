import { useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, Spinner, Stack, Toast } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendProgressContainer() {
  const intl = useIntl();
  const submitted = useRef(false);
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { networkId, accountId, unsignedTxs, onSuccess, onFail } = route.params;

  usePromiseResult(async () => {
    const signedTxs: ISignedTxPro[] = [];
    if (submitted.current) return;
    submitted.current = true;
    try {
      for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
        const unsignedTx = unsignedTxs[i];
        const signedTx = await backgroundApiProxy.serviceSend.signTransaction({
          networkId,
          accountId,
          unsignedTx,
        });

        const txid = await backgroundApiProxy.serviceSend.broadcastTransaction({
          networkId,
          signedTx,
        });

        signedTxs.push({
          ...signedTx,
          txid,
        });

        if (signedTx) {
          await backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
            networkId,
            accountId,
            data: {
              signedTx,
              decodedTx: await backgroundApiProxy.serviceSend.buildDecodedTx({
                networkId,
                accountId,
                unsignedTx,
              }),
            },
          });
        }
      }

      onSuccess?.(signedTxs);
      Toast.success({
        title: intl.formatMessage({ id: 'msg__transaction_submitted' }),
      });
      navigation.popStack();
    } catch (e: any) {
      Toast.error({
        title: (e as Error).message,
      });
      onFail?.(e as Error);
      navigation.pop();
      throw e;
    }
  }, [accountId, intl, navigation, networkId, onFail, onSuccess, unsignedTxs]);

  return (
    <Page>
      <Page.Body>
        <Stack height="100%" alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export { SendProgressContainer };
