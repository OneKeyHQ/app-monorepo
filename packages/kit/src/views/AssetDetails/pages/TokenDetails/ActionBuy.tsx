import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { ActionItem } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useFiatCrypto, useSupportNetworkId } from '../../../FiatCrypto/hooks';

import type { IActionProps } from './type';

function ActionBuyInner({
  networkId,
  accountId,
  walletId,
  walletType,
  ...rest
}: IActionProps) {
  const intl = useIntl();
  const { result: isSupported } = useSupportNetworkId('buy', networkId);

  const { handleFiatCrypto } = useFiatCrypto({
    networkId,
    accountId,
    fiatCryptoType: 'buy',
  });

  const isDisabled = useMemo(() => {
    if (walletType === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }
    if (!isSupported) {
      return true;
    }
    return false;
  }, [isSupported, walletType]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handlePress = useCallback(async () => {
    if (isDisabled) return;

    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId,
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionBuy({
      walletType: walletType ?? '',
      networkId: networkId ?? '',
      source: 'tokenDetails',
      isSoftwareWalletOnlyUser,
    });

    handleFiatCrypto(undefined);
  }, [
    isDisabled,
    walletId,
    walletType,
    networkId,
    isSoftwareWalletOnlyUser,
    handleFiatCrypto,
  ]);

  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.buy_and_sell })}
      icon="CurrencyDollarOutline"
      disabled={isDisabled}
      onPress={handlePress}
      {...rest}
    />
  );
}

const ActionBuy = (props: IActionProps) => (
  <HomeTokenListProviderMirror>
    <ActionBuyInner {...props} />
  </HomeTokenListProviderMirror>
);

export default ActionBuy;
