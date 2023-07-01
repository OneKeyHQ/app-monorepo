import { useEffect } from 'react';

import { Box } from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import { wait } from '../../../../utils/helper';
import {
  canShowAppReview,
  openAppReview,
} from '../../../../utils/openAppReview';
import { ConnectWalletButton } from '../Buttons/connect';
import { SwapMainButton } from '../Buttons/swap';
import { PaddingControl } from '../PaddingControl';

import { SwapAlert } from './SwapAlert';
import { SwapContent } from './SwapContent';
import { SwapQuote } from './SwapQuote';


import {
  getActiveWalletAccount,
} from '@onekeyhq/kit/src/hooks/redux';



export function SwapMain() {
  useEffect(() => {
    const listener = async () => {
      const show = await canShowAppReview();
      if (show) {
        await wait(2000);
        openAppReview();
      }
    };
    appUIEventBus.on(AppUIEventBusNames.SwapAddTransaction, listener);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.SwapAddTransaction, listener);
    };
  }, []);
  return (
    <Box>
      <SwapContent />
      <PaddingControl>
        <SwapAlert />
        <Box mt="6" mb="3">
          <SwapMainButton />
        </Box>
        <SwapQuote />
        {!getActiveWalletAccount().accountId && <ConnectWalletButton />}
      </PaddingControl>
    </Box>
  );
}
