import { useCallback, useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
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

function MessageConfirmFromDapp() {
  const navigation = useNavigation();
  const pendingAction = useRef<StackActionType>(undefined);
  const {
    $sourceInfo,
    unsignedMessage,
    accountId,
    networkId,
    walletInternalSign,
    skipBackupCheck,
    _$t = undefined,
  } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    walletInternalSign?: boolean;
    skipBackupCheck?: boolean;
    _$t: number | undefined;
  }>();

  console.log('MessageConfirmFromDapp Start:', {
    unsignedMessage,
  });

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const isNavigateNewPageRef = useRef(false);

  const signatureConfirmRoute = EModalSignatureConfirmRoutes.MessageConfirm;

  const dispatchAction = useCallback(
    (action: NavigationAction | ((state: any) => NavigationAction)) => {
      isNavigateNewPageRef.current = true;
      const timerId = setTimeout(() => {
        dappApprove.reject();
      }, 1200);
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

    const navigationToMessageConfirm = async () => {
      let action: any;
      if (unsignedMessage) {
        const params: IModalSignatureConfirmParamList[EModalSignatureConfirmRoutes.MessageConfirm] =
          {
            networkId,
            accountId,
            unsignedMessage,
            sourceInfo: $sourceInfo,
            walletInternalSign,
            skipBackupCheck,
            // @ts-ignore
            _disabledAnimationOfNavigate: true,
            _$t,
          };
        // replace router to MessageConfirm
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

    void navigationToMessageConfirm();

    return () => {
      appStateListener.remove();
    };
  }, [
    navigation,
    networkId,
    accountId,
    $sourceInfo,
    dispatchAction,
    signatureConfirmRoute,
    unsignedMessage,
    walletInternalSign,
    skipBackupCheck,
    _$t,
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

export default MessageConfirmFromDapp;
