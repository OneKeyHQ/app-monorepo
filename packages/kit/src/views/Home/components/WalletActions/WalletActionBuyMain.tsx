import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionBuyMain({
  customization,
}: {
  customization?: IActionCustomization;
}) {
  const intl = useIntl();
  const {
    activeAccount: { network, wallet, account },
  } = useActiveAccount({ num: 0 });
  const { isSupported: isBuySupported, handleFiatCrypto: handleBuyFiatCrypto } =
    useFiatCrypto({
      networkId: network?.id ?? '',
      accountId: account?.id ?? '',
      fiatCryptoType: 'buy',
    });
  const {
    isSupported: isSellSupported,
    handleFiatCrypto: handleSellFiatCrypto,
  } = useFiatCrypto({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
    fiatCryptoType: 'sell',
  });

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isAddMoneyBlockedByBotWallet = isBotWallet && isBotWalletDeactivated;

  const shouldOpenSellForBotWallet =
    !customization?.onPress && isAddMoneyBlockedByBotWallet && isSellSupported;

  const isBuyAndSellDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isBuySupported && !isSellSupported) {
      return true;
    }

    if (isAddMoneyBlockedByBotWallet && !isSellSupported) {
      return true;
    }

    return false;
  }, [
    isBuySupported,
    isSellSupported,
    wallet?.type,
    isAddMoneyBlockedByBotWallet,
  ]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleBuyToken = useCallback(async () => {
    if (isAddMoneyBlockedByBotWallet && !shouldOpenSellForBotWallet) {
      showBotWalletDisabledToast('addMoney');
      return;
    }
    if (isBuyAndSellDisabled) return;

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
    } else if (shouldOpenSellForBotWallet) {
      handleSellFiatCrypto({});
    } else {
      handleBuyFiatCrypto({});
    }
  }, [
    isAddMoneyBlockedByBotWallet,
    shouldOpenSellForBotWallet,
    isBuyAndSellDisabled,
    handleBuyFiatCrypto,
    handleSellFiatCrypto,
    network,
    wallet,
    isSoftwareWalletOnlyUser,
    customization,
  ]);

  return (
    <RawActions.Buy
      onPress={handleBuyToken}
      label={
        customization?.labelId
          ? intl.formatMessage({ id: customization.labelId })
          : undefined
      }
      icon={customization?.icon}
      disabled={customization?.disabled ?? isBuyAndSellDisabled}
      allowPressWhenDisabled={
        isAddMoneyBlockedByBotWallet === true
          ? !shouldOpenSellForBotWallet
          : undefined
      }
      trackID="wallet-buy"
      testID={HomeTestIDs.buyButton}
    />
  );
}

export { WalletActionBuyMain };
