import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAllTokenListMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export function WalletActionSell({ onClose }: { onClose: () => void }) {
  const {
    activeAccount: { network, account, wallet, vaultSettings, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { isSupported, handleFiatCrypto } = useFiatCrypto({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
    fiatCryptoType: 'sell',
  });

  const intl = useIntl();

  const [map] = useAllTokenListMapAtom();

  const { result: nativeToken } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
      }),
    [network?.id, account?.id],
  );

  const isSellDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSupported) {
      return true;
    }

    return false;
  }, [isSupported, wallet?.type]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleSellToken = useCallback(async () => {
    if (isSellDisabled) return;

    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionSell({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });

    handleFiatCrypto();
    onClose();
  }, [
    isSellDisabled,
    wallet?.id,
    wallet?.type,
    network?.id,
    isSoftwareWalletOnlyUser,
    handleFiatCrypto,
    onClose,
  ]);

  if (
    !network?.isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    vaultSettings?.mergeDeriveAssetsEnabled &&
    nativeToken &&
    !isSellDisabled
  ) {
    return (
      <AddressTypeSelector
        placement="bottom-end"
        offset={{
          crossAxis: -16,
        }}
        walletId={wallet?.id ?? ''}
        networkId={network?.id ?? ''}
        indexedAccountId={indexedAccount?.id ?? ''}
        renderSelectorTrigger={
          <ActionList.Item
            trackID="wallet-sell"
            icon="MinusLargeOutline"
            label={intl.formatMessage({ id: ETranslations.global_cash_out })}
            disabled={isSellDisabled}
            onClose={() => {}}
            onPress={() => {}}
          />
        }
        tokenMap={map}
        onSelect={async ({
          account: a,
        }: {
          account: INetworkAccount | undefined;
        }) => {
          const { url } =
            await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
              networkId: network?.id ?? '',
              tokenAddress: nativeToken.address,
              accountId: a?.id ?? '',
              type: 'sell',
            });
          openUrlExternal(url);
          onClose();
        }}
        doubleConfirm
      />
    );
  }

  return (
    <ActionList.Item
      trackID="wallet-sell"
      icon="MinusLargeOutline"
      label={intl.formatMessage({ id: ETranslations.global_cash_out })}
      onClose={() => {}}
      onPress={handleSellToken}
      disabled={isSellDisabled}
    />
  );
}
