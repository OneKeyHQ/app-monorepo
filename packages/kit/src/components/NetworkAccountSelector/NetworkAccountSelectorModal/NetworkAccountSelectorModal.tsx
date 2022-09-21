/* eslint-disable @typescript-eslint/ban-types */
import React, { useEffect, useRef } from 'react';

import { Box, Modal, useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY } from '../../Header/AccountSelectorChildren/accountSelectorConsts';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

import AccountList from './AccountList';
import ChainSelector from './ChainSelector';
import Header from './Header';

const { updateIsOpenDelay } = reducerAccountSelector.actions;
function NetworkAccountSelectorModal() {
  const { dispatch } = backgroundApiProxy;
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const isOpen = isMountedRef.current;
  const accountSelectorInfo = useAccountSelectorInfo({
    isOpen,
  });

  const isVertical = useIsVerticalLayout();

  // delay wait drawer closed animation done
  const isOpenDelay = useDebounce(
    isOpen,
    isVertical ? ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY : 150,
  );
  useEffect(() => {
    dispatch(updateIsOpenDelay(Boolean(isOpenDelay)));
  }, [dispatch, isOpenDelay]);

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
