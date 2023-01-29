import { useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { getActiveWalletAccount } from '../../../hooks/redux';
import useDappParams from '../../../hooks/useDappParams';
import { SendRoutes } from '../types';

import type {
  SendConfirmParams,
  SendRoutesParams,
  SignMessageConfirmParams,
} from '../types';
import type { NavigationProp, StackActionType } from '@react-navigation/native';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;

export function SendConfirmFromDapp() {
  const navigation = useNavigation<NavigationProps>();
  const pendingAction = useRef<StackActionType>();
  // const navigation = useAppNavigation();
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
    // TODO providerName
    if (encodedTx) {
      const params: SendConfirmParams = {
        networkId: dappNetworkId ?? networkId,
        accountId,
        sourceInfo,
        encodedTx,
        feeInfoEditable: true,
        feeInfoUseFeeInTx: false,
        signOnly,
        // @ts-ignore
        _disabledAnimationOfNavigate: true,
        _$t,
      };
      // replace router to SendConfirm
      action = StackActions.replace(SendRoutes.SendConfirm, params);
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
      action = StackActions.replace(SendRoutes.SignMessageConfirm, params);
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
