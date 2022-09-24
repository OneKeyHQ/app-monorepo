/* eslint-disable @typescript-eslint/ban-types */
import React, { useEffect, useRef } from 'react';

import { Box, Modal } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY } from '../../Header/AccountSelectorChildren/accountSelectorConsts';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

import AccountList from './AccountList';
import ChainSelector from './ChainSelector';
import Header from './Header';

const { updateIsOpenDelay, updateIsOpen } = reducerAccountSelector.actions;
function NetworkAccountSelectorModal() {
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

  if (!accountSelectorInfo.isOpenDelay && platformEnv.isNativeAndroid) {
    return null;
  }

  return (
    <Modal
      headerShown={false}
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
    >
      <Box flex={1} flexDirection="row">
        <ChainSelector accountSelectorInfo={accountSelectorInfo} />
        <Box alignSelf="stretch" flex={1}>
          <Header accountSelectorInfo={accountSelectorInfo} />
          <AccountList accountSelectorInfo={accountSelectorInfo} />
        </Box>
      </Box>
    </Modal>
  );
}

export { NetworkAccountSelectorModal };
