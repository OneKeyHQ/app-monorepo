import { useEffect } from 'react';

import {
  NavigationProp,
  StackActions,
  useNavigation,
} from '@react-navigation/native';

import useDappParams from '../../hooks/useDappParams';

import { SendConfirmParams, SendRoutes, SendRoutesParams } from './types';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;

function SendConfirmFromDapp() {
  const navigation = useNavigation<NavigationProps>();
  const {
    sourceInfo,
    unsignedMessage,
    encodedTx,
    signOnly = false,
  } = useDappParams();
  useEffect(() => {
    let action: any;
    // TODO providerName
    if (encodedTx) {
      const params: SendConfirmParams = {
        sourceInfo,
        encodedTx,
        feeInfoEditable: true,
        feeInfoUseFeeInTx: false,
        signOnly,
      };
      // replace router to SendConfirm
      action = StackActions.replace(SendRoutes.SendConfirm, params);
    }
    if (unsignedMessage) {
      action = StackActions.replace(SendRoutes.SignMessageConfirm, {
        sourceInfo,
        unsignedMessage,
      });
    }
    if (action) {
      navigation.dispatch(action);
    }
  }, [encodedTx, navigation, sourceInfo, unsignedMessage, signOnly]);

  return null;
}

export { SendConfirmFromDapp };
