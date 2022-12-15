import { useEffect } from 'react';

import {
  NavigationProp,
  StackActions,
  useNavigation,
} from '@react-navigation/native';

import { getActiveWalletAccount } from '../../../hooks/redux';
import useDappParams from '../../../hooks/useDappParams';
import {
  SendConfirmParams,
  SendRoutes,
  SendRoutesParams,
  SignMessageConfirmParams,
} from '../types';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;

export function SendConfirmFromDapp() {
  const navigation = useNavigation<NavigationProps>();
  // const navigation = useAppNavigation();
  const {
    sourceInfo,
    unsignedMessage,
    encodedTx,
    signOnly = false,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _$t = undefined,
  } = useDappParams();
  useEffect(() => {
    let action: any;
    // TODO get network and account from dapp connections
    const { networkId, accountId } = getActiveWalletAccount();
    // TODO providerName
    if (encodedTx) {
      const params: SendConfirmParams = {
        networkId,
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
        networkId,
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
      setTimeout(() => navigation.dispatch(action));
    }
  }, [_$t, encodedTx, navigation, sourceInfo, unsignedMessage, signOnly]);

  return null;
}
