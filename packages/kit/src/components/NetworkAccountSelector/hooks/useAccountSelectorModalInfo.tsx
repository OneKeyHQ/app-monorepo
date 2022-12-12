import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY } from '../../Header/AccountSelectorChildren/accountSelectorConsts';

import { useAccountSelectorInfo } from './useAccountSelectorInfo';

const { updateIsOpenDelay, updateIsOpen } = reducerAccountSelector.actions;

export function useAccountSelectorModalInfo() {
  const { dispatch } = backgroundApiProxy;

  const isMountedRef = useRef(false);
  useEffect(() => {
    setTimeout(() => {
      isMountedRef.current = true;
      dispatch(updateIsOpen(true));
    }, 50);

    // delay wait drawer closed animation done
    setTimeout(() => {
      dispatch(updateIsOpenDelay(true));
    }, ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY);

    return () => {
      setTimeout(() => {
        isMountedRef.current = false;
        dispatch(updateIsOpen(false));
      }, 50);

      setTimeout(() => {
        dispatch(updateIsOpenDelay(false));
      }, ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY);
    };
  }, [dispatch]);

  const accountSelectorInfo = useAccountSelectorInfo();

  let shouldShowModal = true;
  if (!accountSelectorInfo.isOpenDelay && platformEnv.isNativeAndroid) {
    shouldShowModal = false;
  }

  return {
    accountSelectorInfo,
    shouldShowModal,
  };
}
