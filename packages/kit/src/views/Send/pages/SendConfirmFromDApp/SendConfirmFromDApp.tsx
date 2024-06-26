import { useCallback, useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';

import type {
  NavigationAction,
  StackActionType,
} from '@react-navigation/native';

function SendConfirmFromDApp() {
  const navigation = useNavigation();
  const pendingAction = useRef<StackActionType>();
  const {
    $sourceInfo,
    encodedTx,
    transfersInfo,
    signOnly = false,
    accountId,
    networkId,
    useFeeInTx = true,
    _$t = undefined,
  } = useDappQuery<{
    encodedTx: IEncodedTx;
    transfersInfo: ITransferInfo[];
    accountId: string;
    networkId: string;
    signOnly: boolean;
    useFeeInTx: boolean;
    _$t: number | undefined;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const isNavigateNewPageRef = useRef(false);

  const dispatchAction = useCallback(
    (action: NavigationAction | ((state: any) => NavigationAction)) => {
      isNavigateNewPageRef.current = true;
      const timerId = setTimeout(() => {
        dappApprove.reject();
      }, 1200);
      appEventBus.once(EAppEventBusNames.SendConfirmContainerMounted, () => {
        clearTimeout(timerId);
      });
      navigation.dispatch(action);
    },
    [dappApprove, navigation],
  );

  const handlePageClose = useCallback(() => {
    if (!isNavigateNewPageRef.current) {
      dappApprove.reject();
    }
  }, [dappApprove]);

  useEffect(() => {
    // OK-16560: navigate when app in background would cause modal render in wrong size
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeout(() => {
          if (pendingAction.current) {
            dispatchAction(pendingAction.current);
          }
          pendingAction.current = undefined;
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
            transfersInfo,
          });
        const params: IModalSendParamList[EModalSendRoutes.SendConfirm] = {
          networkId,
          accountId,
          unsignedTxs: [unsignedTx],
          sourceInfo: $sourceInfo,
          signOnly,
          useFeeInTx,
          // @ts-ignore
          _disabledAnimationOfNavigate: true,
          _$t,
        };
        // replace router to SendConfirm
        action = StackActions.replace(EModalSendRoutes.SendConfirm, params);
      }

      if (action) {
        if (AppState.currentState === 'active') {
          setTimeout(() => dispatchAction(action));
        } else {
          pendingAction.current = action;
        }
      }
    };

    void navigationToSendConfirm();

    return () => {
      appStateListener.remove();
    };
  }, [
    encodedTx,
    navigation,
    signOnly,
    networkId,
    accountId,
    $sourceInfo,
    _$t,
    transfersInfo,
    useFeeInTx,
    dispatchAction,
  ]);

  return (
    <Page onClose={handlePageClose}>
      <Page.Body>
        <Stack h="100%" justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export { SendConfirmFromDApp };
