/* eslint-disable @typescript-eslint/ban-types */
import React, { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY } from '../../Header/AccountSelectorChildren/accountSelectorConsts';
import { LazyDisplayView } from '../../LazyDisplayView';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

import AccountList from './AccountList';
import Header from './Header';
import SideChainSelector from './SideChainSelector';

const { updateIsOpenDelay, updateIsOpen } = reducerAccountSelector.actions;
// use Modal header or custom header
const showCustomLegacyHeader = false;
function NetworkAccountSelectorModal() {
  const { dispatch } = backgroundApiProxy;
  const [showSideChainSelector, setShowSideChainSelector] = useState(false);
  const isMountedRef = useRef(false);
  const intl = useIntl();
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
      headerShown={!showCustomLegacyHeader}
      header={intl.formatMessage({ id: 'title__accounts' })}
      // TODO loading
      headerDescription={
        <Pressable
          onPress={() => {
            setShowSideChainSelector(!showSideChainSelector);
          }}
        >
          <Typography.Caption textAlign="center" color="text-subdued">
            {accountSelectorInfo?.selectedNetwork?.name || '-'}
          </Typography.Caption>
        </Pressable>
      }
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
    >
      <LazyDisplayView delay={0}>
        <Box flex={1} flexDirection="row">
          {showSideChainSelector ? (
            <SideChainSelector accountSelectorInfo={accountSelectorInfo} />
          ) : null}
          <Box alignSelf="stretch" flex={1}>
            <Header
              accountSelectorInfo={accountSelectorInfo}
              showCustomLegacyHeader={showCustomLegacyHeader}
            />
            <AccountList accountSelectorInfo={accountSelectorInfo} />
          </Box>
        </Box>
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkAccountSelectorModal };
