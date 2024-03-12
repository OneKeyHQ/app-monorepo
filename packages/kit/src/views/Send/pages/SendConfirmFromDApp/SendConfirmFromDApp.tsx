import { useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';

import type { StackActionType } from '@react-navigation/native';

function SendConfirmFromDApp() {
  const navigation = useNavigation();
  const pendingAction = useRef<StackActionType>();
  const {
    $sourceInfo,
    encodedTx,
    signOnly = false,
    accountId,
    networkId,
    _$t = undefined,
  } = useDappQuery<{
    encodedTx: IEncodedTx;
    accountId: string;
    networkId: string;
    signOnly: boolean;
    _$t: number | undefined;
  }>();

  useEffect(() => {
    // OK-16560: navigate when app in background would cause modal render in wrong size
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeout(() => {
          if (pendingAction.current) {
            navigation.dispatch(pendingAction.current);
            pendingAction.current = undefined;
          }
        });
      }
    });

    const navigationToSendConfirm = async () => {
      let action: any;

      if (encodedTx) {
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            accountId,
            networkId,
            encodedTx,
          });
        const params: IModalSendParamList[EModalSendRoutes.SendConfirm] = {
          networkId,
          accountId,
          unsignedTxs: [unsignedTx],
          sourceInfo: $sourceInfo,
          signOnly,
          // @ts-ignore
          _disabledAnimationOfNavigate: true,
          _$t,
        };
        // replace router to SendConfirm
        action = StackActions.replace(EModalSendRoutes.SendConfirm, params);
      }

      if (action) {
        if (AppState.currentState === 'active') {
          setTimeout(() => navigation.dispatch(action));
        } else {
          pendingAction.current = action;
        }
      }
    };

    void navigationToSendConfirm();

    return () => {
      appStateListener.remove();
    };
  }, [encodedTx, navigation, signOnly, networkId, accountId, $sourceInfo, _$t]);

  return (
    <Page>
      <Page.Body>
        <Stack h="100%" justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export { SendConfirmFromDApp };
