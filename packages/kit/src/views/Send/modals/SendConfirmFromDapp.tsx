import { useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';

import { getActiveWalletAccount } from '../../../hooks';
import useDappParams from '../../../hooks/useDappParams';
import { useReduxReady } from '../../../hooks/useReduxReady';
import { SendModalRoutes } from '../types';

import type {
  SendConfirmParams,
  SendRoutesParams,
  SignMessageConfirmParams,
} from '../types';
import type { NavigationProp, StackActionType } from '@react-navigation/native';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendModalRoutes.SendConfirm
>;

export function SendConfirmFromDapp() {
  const navigation = useNavigation<NavigationProps>();
  const pendingAction = useRef<StackActionType>();
  const { isReady } = useReduxReady();
  const {
    sourceInfo,
    unsignedMessage,
    encodedTx,
    signOnly = false,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _$t = undefined,
    networkId: dappNetworkId,
  } = useDappParams();
  useEffect(() => {
    if (!isReady) {
      return;
    }
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
    let action: any;
    // TODO get network and account from dapp connections
    const { networkId, accountId } = getActiveWalletAccount();

    // alert(JSON.stringify({ networkId, accountId, isReady }));
    // TODO providerName
    if (encodedTx) {
      const isPsbt = (encodedTx as IEncodedTxBtc).psbtHex;

      const params: SendConfirmParams = {
        networkId: dappNetworkId ?? networkId,
        accountId,
        sourceInfo,
        encodedTx,
        feeInfoEditable: !isPsbt,
        feeInfoUseFeeInTx: true,
        ignoreFetchFeeCalling: !!isPsbt,
        signOnly,
        // @ts-ignore
        _disabledAnimationOfNavigate: true,
        _$t,
      };
      // replace router to SendConfirm
      action = StackActions.replace(SendModalRoutes.SendConfirm, params);
    }

    if (unsignedMessage) {
      const params: SignMessageConfirmParams = {
        networkId: dappNetworkId ?? networkId,
        accountId,
        sourceInfo,
        unsignedMessage,
        // @ts-ignore
        _disabledAnimationOfNavigate: true,
        _$t,
      };
      action = StackActions.replace(SendModalRoutes.SignMessageConfirm, params);
    }
    if (action) {
      if (AppState.currentState === 'active') {
        setTimeout(() => navigation.dispatch(action));
      } else {
        pendingAction.current = action;
      }
    }
    return () => {
      appStateListener.remove();
    };
  }, [
    isReady,
    _$t,
    encodedTx,
    navigation,
    sourceInfo,
    unsignedMessage,
    signOnly,
    dappNetworkId,
  ]);

  return null;
}
