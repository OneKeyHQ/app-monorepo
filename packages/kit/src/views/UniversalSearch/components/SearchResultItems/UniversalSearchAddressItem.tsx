import { useCallback } from 'react';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
    networkId: item.payload.network?.id,
  });

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
    return (
      <>
        <AccountValueWithSpotlight
          isOthersUniversal={accountUtils.isOthersAccount({
            accountId: item.payload.account?.id,
          })}
          index={0}
          accountValue={item.payload.accountsValue}
          linkedAccountId={item.payload.account?.id}
          linkedNetworkId={item.payload.network?.id}
          indexedAccountId={item.payload.indexedAccount?.id}
          mergeDeriveAssetsEnabled={vaultSettings?.mergeDeriveAssetsEnabled}
        />
        {item.payload.addressInfo?.displayAddress ? (
          <Stack
            mx="$1.5"
            w="$1"
            h="$1"
            bg="$iconSubdued"
            borderRadius="$full"
          />
        ) : null}
      </>
    );
  }, [
    item.payload.account?.id,
    item.payload.accountsValue,
    item.payload.network?.id,
    item.payload.indexedAccount?.id,
    item.payload.addressInfo?.displayAddress,
    vaultSettings?.mergeDeriveAssetsEnabled,
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
