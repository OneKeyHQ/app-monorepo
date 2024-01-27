import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  LottieView,
  Page,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendProgressContainer() {
  const intl = useIntl();
  const [currentProgress, setCurrentProgress] = useState(0);
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { networkId, accountId, unsignedTxs, onSuccess } = route.params;

  usePromiseResult(async () => {
    const signedTxs: ISignedTxPro[] = [];
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

        setCurrentProgress(i);
        // TODO: save local history
      }

      onSuccess?.(signedTxs);
    } catch (e) {
      navigation.pop();
      throw e;
    }
  }, [accountId, navigation, networkId, onSuccess, unsignedTxs]);

  const isSendSuccess = currentProgress === unsignedTxs.length;

  return (
    <Page>
      <Page.Body>
        <Stack height="100%" alignItems="center" justifyContent="center">
          {isSendSuccess ? (
            <LottieView
              width="100%"
              height="$24"
              autoPlay
              loop={false}
              source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
            />
          ) : (
            <YStack padding="$4" space="$4">
              <Progress value={currentProgress} max={unsignedTxs.length} />
              <SizableText>
                {currentProgress}/{unsignedTxs.length}
              </SizableText>
            </YStack>
          )}
        </Stack>
      </Page.Body>
      {isSendSuccess && (
        <Page.Footer>
          <XStack padding="$4">
            <Button variant="primary" onPress={() => navigation.popStack()}>
              {intl.formatMessage({ id: 'action__done' })}
            </Button>
          </XStack>
        </Page.Footer>
      )}
    </Page>
  );
}

export { SendProgressContainer };
