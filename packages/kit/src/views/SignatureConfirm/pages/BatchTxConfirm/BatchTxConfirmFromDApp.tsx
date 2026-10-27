import { useCallback, useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSignatureConfirmParamList } from '@onekeyhq/shared/src/routes';

import type {
  NavigationAction,
  StackActionType,
} from '@react-navigation/native';

// Thin dapp query -> route param shim for the batch PSBT signing flow,
// mirroring SendConfirmFromDApp/MessageConfirmFromDapp: parse the query
// channel, then replace this screen with the shared BatchTxConfirm page.
function BatchTxConfirmFromDApp() {
  const navigation = useNavigation();
  const pendingAction = useRef<StackActionType>(undefined);
  const { $sourceInfo, batchId, accountId, networkId } = useDappQuery<{
    batchId: string;
    accountId: string;
    networkId: string;
  }>();

  console.log('BatchTxConfirmFromDApp Start:', {
    batchId,
  });

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const isNavigateNewPageRef = useRef(false);

  const signatureConfirmRoute = EModalSignatureConfirmRoutes.BatchTxConfirm;

  const dispatchAction = useCallback(
    (action: NavigationAction | ((state: any) => NavigationAction)) => {
      isNavigateNewPageRef.current = true;
      const timerId = setTimeout(() => {
        dappApprove.reject();
      }, 5000);
      appEventBus.once(
        EAppEventBusNames.SignatureConfirmContainerMounted,
        () => {
          clearTimeout(timerId);
        },
      );
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

    const navigationToBatchTxConfirm = async () => {
      let action: any;
      if (batchId) {
        const params: IModalSignatureConfirmParamList[EModalSignatureConfirmRoutes.BatchTxConfirm] =
          {
            batchId,
            accountId,
            networkId,
            sourceInfo: $sourceInfo,
          };
        // Replace the DApp entry screen with the shared BatchTxConfirm page.
        action = StackActions.replace(signatureConfirmRoute, params);
      }

      if (action) {
        if (AppState.currentState === 'active') {
          setTimeout(() => dispatchAction(action));
        } else {
          pendingAction.current = action;
        }
      }
    };

    void navigationToBatchTxConfirm();

    return () => {
      appStateListener.remove();
    };
  }, [
    batchId,
    accountId,
    networkId,
    $sourceInfo,
    dispatchAction,
    signatureConfirmRoute,
  ]);

  return (
    <Page onClose={handlePageClose}>
      <Page.Body bg="$bgApp">
        <Stack
          h="100%"
          justifyContent="center"
          alignContent="center"
          bg="$bgApp"
        >
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default BatchTxConfirmFromDApp;
