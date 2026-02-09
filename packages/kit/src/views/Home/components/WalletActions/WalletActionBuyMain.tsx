import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionBuyMain({
  customization,
}: {
  customization?: IActionCustomization;
}) {
  const {
    activeAccount: { network, wallet, account },
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

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleBuyToken = useCallback(async () => {
    if (isBuyDisabled) return;

    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionBuy({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });

    if (customization?.onPress) {
      void customization.onPress();
    } else {
      handleFiatCrypto({});
    }
  }, [
    isBuyDisabled,
    handleFiatCrypto,
    network,
    wallet,
    isSoftwareWalletOnlyUser,
    customization,
  ]);

  return (
    <RawActions.Buy
      onPress={handleBuyToken}
      label={customization?.label}
      icon={customization?.icon}
      disabled={customization?.disabled ?? isBuyDisabled}
      trackID="wallet-buy"
    />
  );
}

export { WalletActionBuyMain };
