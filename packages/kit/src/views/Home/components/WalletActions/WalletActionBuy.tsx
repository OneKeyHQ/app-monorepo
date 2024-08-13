import { useMemo } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RawActions } from './RawActions';

export function WalletActionBuy() {
  const {
    activeAccount: { network, account, wallet },
  } = useActiveAccount({ num: 0 });

  const { isSupported, handleFiatCrypto } = useFiatCrypto({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
    fiatCryptoType: 'buy',
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

  return <RawActions.Buy onPress={handleFiatCrypto} disabled={isBuyDisabled} />;
}
