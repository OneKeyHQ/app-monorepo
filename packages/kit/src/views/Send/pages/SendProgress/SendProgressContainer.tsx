import { useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  LottieView,
  Page,
  Spinner,
  Stack,
  Toast,
  useMedia,
} from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendProgressContainer() {
  const intl = useIntl();
  const media = useMedia();
  const [currentProgress, setCurrentProgress] = useState(0);
  const submitted = useRef(false);
  const tableLayout = media.gtLg;
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

        setCurrentProgress(i + 1);

        // TODO: save local history
      }

      onSuccess?.(signedTxs);
      Toast.success({
        title: intl.formatMessage({ id: 'msg__transaction_submitted' }),
      });
    } catch (e: any) {
      Toast.error({
        title: (e as Error).message,
      });
      onFail?.(e as Error);
      navigation.pop();
      throw e;
    }
  }, [accountId, intl, navigation, networkId, onFail, onSuccess, unsignedTxs]);

  const isSendSuccess = currentProgress === unsignedTxs.length;

  return (
    <Page>
      <Page.Body>
        <Stack height="100%" alignItems="center" justifyContent="center">
          {isSendSuccess ? (
            <LottieView
              width={200}
              height={200}
              autoPlay
              loop={false}
              source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
            />
          ) : (
            <Stack
              width="100%"
              height="100%"
              alignItems="center"
              justifyContent="center"
            >
              <Spinner size="large" />
            </Stack>
          )}
        </Stack>
      </Page.Body>
      {isSendSuccess && (
        <Page.Footer
          confirmButtonProps={{
            size: tableLayout ? 'medium' : 'large',
          }}
          onConfirmText={intl.formatMessage({ id: 'action__done' })}
          onConfirm={() => navigation.popStack()}
        />
      )}
    </Page>
  );
}

export { SendProgressContainer };
