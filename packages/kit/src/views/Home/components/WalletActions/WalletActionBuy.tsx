import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAllTokenListMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import {
  useFiatCrypto,
  useSupportNetworkId,
} from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IWalletActionBaseParams } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/walletActions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  openFiatCryptoUrl,
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export function WalletActionBuy({
  onClose,
  renderTrigger,
  source,
  sameModal,
}: {
  onClose: () => void;
  renderTrigger?: (props: {
    onPress: () => void;
    disabled: boolean;
  }) => ReactElement;
  source?: IWalletActionBaseParams['source'];
  sameModal?: boolean;
}) {
  const {
    activeAccount: { network, account, wallet, vaultSettings, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { isSupported: isBuySupported, handleFiatCrypto } = useFiatCrypto({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
    fiatCryptoType: 'buy',
  });
  const { result: isSellSupported } = useSupportNetworkId('sell', network?.id);

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

  const isBuyDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isBuySupported && !isSellSupported) {
      return true;
    }

    return false;
  }, [isBuySupported, isSellSupported, wallet?.type]);

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
      source: source ?? 'homePage',
      isSoftwareWalletOnlyUser,
    });

    handleFiatCrypto({ sameModal });
    onClose();
  }, [
    isBuyDisabled,
    handleFiatCrypto,
    network,
    wallet,
    isSoftwareWalletOnlyUser,
    onClose,
    source,
    sameModal,
  ]);

  if (
    isBuySupported &&
    !network?.isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    vaultSettings?.mergeDeriveAssetsEnabled &&
    nativeToken &&
    !isBuyDisabled
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
          renderTrigger ? (
            renderTrigger({
              disabled: isBuyDisabled,
              onPress: () => {},
            })
          ) : (
            <ActionList.Item
              trackID="wallet-buy"
              icon="CurrencyDollarOutline"
              label={intl.formatMessage({ id: ETranslations.buy_and_sell })}
              disabled={isBuyDisabled}
              onClose={() => {}}
              onPress={() => {}}
            />
          )
        }
        tokenMap={map}
        onSelect={async ({
          account: a,
        }: {
          account: INetworkAccount | undefined;
        }) => {
          defaultLogger.wallet.walletActions.buyStarted({
            tokenAddress: nativeToken.address,
            tokenSymbol: nativeToken.symbol,
            networkID: network?.id ?? '',
          });
          const { url } =
            await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
              networkId: network?.id ?? '',
              tokenAddress: nativeToken.address,
              accountId: a?.id ?? '',
              type: 'buy',
            });
          if (!url) return;
          if (platformEnv.isDesktop || platformEnv.isNative) {
            openFiatCryptoUrl(url);
          } else {
            openUrlExternal(url);
            onClose();
          }
        }}
        doubleConfirm
      />
    );
  }

  if (renderTrigger) {
    return renderTrigger({
      disabled: isBuyDisabled,
      onPress: handleBuyToken,
    });
  }

  return (
    <ActionList.Item
      trackID="wallet-buy"
      icon="CurrencyDollarOutline"
      label={intl.formatMessage({ id: ETranslations.buy_and_sell })}
      onClose={() => {}}
      onPress={handleBuyToken}
      disabled={isBuyDisabled}
    />
  );
}
