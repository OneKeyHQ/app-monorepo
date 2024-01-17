import { useEffect, useRef } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { getActiveWalletAccount } from '../../../hooks';
import useDappParams from '../../../hooks/useDappParams';
import { useReduxReady } from '../../../hooks/useReduxReady';
import { InscribeModalRoutes } from '../../../routes/routesEnum';

import type { StackActionType } from '@react-navigation/native';

function InscribeTransferFromDapp() {
  const navigation = useNavigation();
  const pendingAction = useRef<StackActionType>();

  const { isReady } = useReduxReady();
  const { sourceInfo, amount, ticker } = useDappParams();

  useEffect(() => {
    if (!isReady) {
      return;
    }
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

    const { networkId, accountId } = getActiveWalletAccount();

    const params = {
      networkId,
      accountId,
      amount,
      token: {
        name: ticker,
        tokenIdOnNetwork: `brc-20--${ticker ?? ''}`,
      },
      sourceInfo,
    };
    const action = StackActions.replace(
      InscribeModalRoutes.BRC20Amount,
      params,
    );

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
  }, [amount, isReady, navigation, sourceInfo, ticker]);

  return null;
}
export { InscribeTransferFromDapp };
