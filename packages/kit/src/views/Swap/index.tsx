import React, { useEffect } from 'react';

import { Box } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import { reset } from '../../store/reducers/swap';

import SwapContent from './SwapContent';
import SwapHeader from './SwapHeader';

const Swap = () => {
  const { network, account } = useActiveWalletAccount();
  useEffect(() => {
    backgroundApiProxy.dispatch(reset());
  }, [network, account]);
  return (
    <Box>
      <SwapHeader />
      <SwapContent />
    </Box>
  );
};

export default Swap;
