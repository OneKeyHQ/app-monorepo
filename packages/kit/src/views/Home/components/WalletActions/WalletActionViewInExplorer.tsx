import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAllTokenListMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export function WalletActionViewInExplorer({
  onClose,
}: {
  onClose: () => void;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, account, wallet, vaultSettings, indexedAccount } =
    activeAccount;

  const intl = useIntl();

  const [map] = useAllTokenListMapAtom();

  const viewExplorerDisabled = useMemo(() => {
    if (!network?.isCustomNetwork) {
      return false;
    }
    if (network?.explorerURL) {
      return false;
    }
    return true;
  }, [network?.isCustomNetwork, network?.explorerURL]);

  const handleViewInExplorer = useCallback(async () => {
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionViewInExplorer({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
    });

    onClose();

    await openExplorerAddressUrl({
      networkId: network?.id,
      address: account?.address,
    });
  }, [account?.address, network?.id, onClose, wallet?.id, wallet?.type]);

  if (
    !viewExplorerDisabled &&
    !network?.isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    vaultSettings?.mergeDeriveAssetsEnabled
  ) {
    return (
      <AddressTypeSelector
        walletId={wallet?.id ?? ''}
        networkId={network?.id ?? ''}
        indexedAccountId={indexedAccount?.id ?? ''}
        renderSelectorTrigger={
          <ActionList.Item
            trackID="wallet-view-in-explorer"
            icon="GlobusOutline"
            label={intl.formatMessage({
              id: ETranslations.global_view_in_blockchain_explorer,
            })}
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
          defaultLogger.wallet.walletActions.actionViewInExplorer({
            walletType: wallet?.type ?? '',
            networkId: network?.id ?? '',
            source: 'homePage',
          });

          onClose();

          await openExplorerAddressUrl({
            networkId: network?.id,
            address: a?.address,
          });
        }}
      />
    );
  }

  return (
    <ActionList.Item
      trackID="wallet-view-in-explorer"
      icon="GlobusOutline"
      label={intl.formatMessage({
        id: ETranslations.global_view_in_blockchain_explorer,
      })}
      onClose={() => {}}
      onPress={handleViewInExplorer}
      disabled={viewExplorerDisabled}
    />
  );
}
