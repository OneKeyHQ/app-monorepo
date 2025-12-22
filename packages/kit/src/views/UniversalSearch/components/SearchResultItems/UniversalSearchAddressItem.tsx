import { useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IUniversalSearchAddress } from '@onekeyhq/shared/types/search';

import { AccountAddress } from '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountAddress';
import { AccountValueWithSpotlight } from '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountValue';
import { urlAccountNavigation } from '../../../Home/pages/urlAccount/urlAccountUtils';

interface IUniversalSearchAddressItemProps {
  item: IUniversalSearchAddress;
  contextNetworkId?: string;
}

export function UniversalSearchAddressItem({
  item,
  contextNetworkId,
}: IUniversalSearchAddressItemProps) {
  const navigation = useAppNavigation();
  const accountSelectorActions = useAccountSelectorActions();
  const universalSearchActions = useUniversalSearchActions();

  const { vaultSettings } = useAccountData({
    networkId: item.payload.network?.id ?? contextNetworkId,
  });

  const { enabledNetworksCompatibleWithWalletId, networkInfoMap } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: item.payload.wallet?.id ?? '',
      networkId: item.payload.network?.id ?? contextNetworkId,
      withNetworksInfo: true,
    });

  const { result: networkAccounts } = usePromiseResult(
    async () => {
      if (!item.payload.indexedAccount?.id || !contextNetworkId) {
        return [];
      }
      return backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
        {
          indexedAccountId: item.payload.indexedAccount.id,
          networkIds: [contextNetworkId],
        },
      );
    },
    [contextNetworkId, item.payload.indexedAccount?.id],
    {
      initResult: [],
    },
  );

  const handleAccountPress = useCallback(async () => {
    navigation.pop();
    if (
      accountUtils.isOthersAccount({
        accountId: item.payload.account?.id,
      })
    ) {
      await accountSelectorActions.current.confirmAccountSelect({
        num: 0,
        indexedAccount: undefined,
        othersWalletAccount: item.payload.account,
        forceSelectToNetworkId: item.payload.network?.id,
      });
    } else {
      await accountSelectorActions.current.confirmAccountSelect({
        num: 0,
        indexedAccount: item.payload.indexedAccount,
        othersWalletAccount: undefined,
        forceSelectToNetworkId: item.payload.network?.id,
      });
    }

    // Add to recent search list
    setTimeout(() => {
      const { addressInfo, network, accountInfo, isSearchedByAccountName } =
        item.payload;

      if (isSearchedByAccountName && accountInfo?.accountName) {
        // User searched by account name, save the original search input
        const encodedSearchInput = encodeURIComponent(accountInfo.accountName);
        universalSearchActions.current.addIntoRecentSearchList({
          id: `${encodedSearchInput}-${accountInfo.accountId}-${
            network?.id || ''
          }-accountName`,
          text: accountInfo.accountName,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            accountId: accountInfo.accountId,
            accountName: accountInfo.formattedName,
            networkId: network?.id || '',
            isAccountName: true,
            originalSearchInput: accountInfo.accountName,
          },
        });
      } else if (addressInfo && network) {
        // User searched by address and found an account
        universalSearchActions.current.addIntoRecentSearchList({
          id: `${addressInfo.displayAddress}-${network.id || ''}-account`,
          text: addressInfo.displayAddress,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            displayAddress: addressInfo.displayAddress,
            networkId: network.id,
            isAccount: true,
          },
        });
      }
    }, 10);
  }, [
    accountSelectorActions,
    item.payload,
    item.type,
    navigation,
    universalSearchActions,
  ]);

  const handleAddressPress = useCallback(() => {
    navigation.pop();
    setTimeout(async () => {
      const { network, addressInfo } = item.payload;
      if (!network || !addressInfo) {
        return;
      }
      await urlAccountNavigation.pushOrReplaceUrlAccountPage(navigation, {
        address: addressInfo.displayAddress,
        networkId: network.id,
        contextNetworkId,
      });
      setTimeout(() => {
        universalSearchActions.current.addIntoRecentSearchList({
          id: `${addressInfo.displayAddress}-${network.id || ''}-${
            contextNetworkId || ''
          }`,
          text: addressInfo.displayAddress,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            displayAddress: addressInfo.displayAddress,
            networkId: network.id,
            contextNetworkId: contextNetworkId || '',
          },
        });
      }, 10);
    }, 80);
  }, [
    contextNetworkId,
    item.payload,
    item.type,
    navigation,
    universalSearchActions,
  ]);

  const renderAccountValue = useCallback(() => {
    if (platformEnv.isWebDappMode || platformEnv.isE2E) return null;

    let linkedAccountId = item.payload.account?.id;
    const linkedNetworkId = item.payload.network?.id ?? contextNetworkId;

    if (
      !item.payload.account &&
      !vaultSettings?.mergeDeriveAssetsEnabled &&
      !networkUtils.isAllNetwork({ networkId: contextNetworkId }) &&
      item.payload.indexedAccount?.id &&
      linkedNetworkId &&
      networkAccounts.length > 0
    ) {
      linkedAccountId = networkAccounts[0].account?.id;
    }

    return (
      <AccountValueWithSpotlight
        walletId={item.payload.wallet?.id ?? ''}
        isOthersUniversal={accountUtils.isOthersAccount({
          accountId: item.payload.account?.id,
        })}
        index={0}
        accountValue={item.payload.accountsValue}
        linkedAccountId={linkedAccountId}
        linkedNetworkId={linkedNetworkId}
        indexedAccountId={item.payload.indexedAccount?.id}
        mergeDeriveAssetsEnabled={vaultSettings?.mergeDeriveAssetsEnabled}
        isSingleAddress={!!item.payload.addressInfo?.displayAddress}
        enabledNetworksCompatibleWithWalletId={
          enabledNetworksCompatibleWithWalletId
        }
        networkInfoMap={networkInfoMap}
        accountDeFiOverview={item.payload.accountsDeFiOverview}
      />
    );
  }, [
    contextNetworkId,
    item,
    networkAccounts,
    vaultSettings?.mergeDeriveAssetsEnabled,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
  ]);

  if (item.payload.account || item.payload.isSearchedByAccountName) {
    return (
      <ListItem
        onPress={handleAccountPress}
        renderAvatar={
          <AccountAvatar
            size="$10"
            borderRadius="$1"
            wallet={item.payload.wallet}
            account={item.payload.account}
            indexedAccount={item.payload.indexedAccount}
          />
        }
        title={item.payload.accountInfo?.formattedName}
        renderItemText={(textProps) => (
          <ListItem.Text
            {...textProps}
            flex={1}
            primary={
              <SizableText size="$bodyLgMedium" numberOfLines={1}>
                {item.payload.accountInfo?.formattedName}
              </SizableText>
            }
            secondary={
              <XStack alignItems="center">
                {renderAccountValue()}
                <AccountAddress
                  num={0}
                  linkedNetworkId={item.payload.network?.id}
                  address={accountUtils.shortenAddress({
                    address: item.payload.addressInfo?.displayAddress,
                  })}
                  isEmptyAddress={false}
                  showSplitter={
                    !(platformEnv.isWebDappMode || platformEnv.isE2E)
                  }
                />
              </XStack>
            }
          />
        )}
        subtitle={item.payload.addressInfo?.displayAddress}
      />
    );
  }

  return (
    <ListItem
      onPress={handleAddressPress}
      renderAvatar={
        <NetworkAvatar networkId={item.payload.network?.id} size="$10" />
      }
      title={item.payload.network?.shortname}
      subtitle={accountUtils.shortenAddress({
        address: item.payload.addressInfo?.displayAddress,
      })}
    />
  );
}
