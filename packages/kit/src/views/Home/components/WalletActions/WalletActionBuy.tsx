import { useMemo } from 'react';

import { useBuyToken } from '@onekeyhq/kit/src/hooks/useBuyToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RawActions } from './RawActions';

export function WalletActionBuy() {
  const {
    activeAccount: { network, account, wallet },
  } = useActiveAccount({ num: 0 });

  const { isSupported, handleOnBuy } = useBuyToken({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
  });

  const isBuyDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSupported) {
      return true;
    }

    return false;
  }, [isSupported, wallet?.type]);

  return <RawActions.Buy onPress={handleOnBuy} disabled={isBuyDisabled} />;
}
