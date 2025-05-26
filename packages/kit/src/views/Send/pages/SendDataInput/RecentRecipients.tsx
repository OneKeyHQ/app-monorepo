import { useEffect, useState } from 'react';

import { Divider, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { AddressListItem } from '@onekeyhq/kit/src/components/AddressList';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

interface IRecentRecipientsProps {
  accountId?: string;
  networkId: string;
  onSelect?: (params: { address: string }) => void;
  searchKey?: string;
  isSearchMode?: boolean;
}

function RecentRecipients(props: IRecentRecipientsProps) {
  const {
    accountId,
    networkId,
    searchKey: rawSearchKey,
    isSearchMode,
    onSelect,
  } = props;

  const { vaultSettings } = useAccountData({ networkId });

  const [filteredRecentRecipients, setFilteredRecentRecipients] = useState<
    IAddressQueryResult[]
  >([]);

  const recentRecipients = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceSignatureConfirm.getRecentRecipients({
          networkId,
        });

      const addressInfoResults = await Promise.all(
        result.map((recipient) =>
          backgroundApiProxy.serviceAccountProfile.queryAddress({
            accountId,
            networkId,
            address: recipient,
            enableAddressBook: true,
            enableWalletName: true,
            enableAddressDeriveInfo: true,
            skipValidateAddress: true,
          }),
        ),
      );

      setFilteredRecentRecipients(addressInfoResults);
      return addressInfoResults;
    },
    [accountId, networkId],
    {
      initResult: [],
    },
  ).result;

  const debouncedSearchKey = useDebounce(rawSearchKey, 300);

  useEffect(() => {
    const searchKey = debouncedSearchKey?.trim().toLowerCase();

    if (!isSearchMode || !searchKey) {
      setFilteredRecentRecipients(recentRecipients);
      return;
    }
    setFilteredRecentRecipients(
      recentRecipients.filter(
        (recipient) =>
          recipient.input?.toLowerCase().includes(searchKey) ||
          recipient.walletAccountName?.toLowerCase().includes(searchKey) ||
          recipient.addressBookName?.toLowerCase().includes(searchKey),
      ),
    );
  }, [debouncedSearchKey, isSearchMode, recentRecipients]);

  return (
    <Stack mx={-20}>
      <Divider mb="$5" borderColor="$borderSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued" mb="$2" ml="$5">
        Recent
      </SizableText>
      {filteredRecentRecipients.map((recipient) => (
        <AddressListItem
          key={recipient.input}
          accountName={recipient.addressBookName ?? recipient.walletAccountName}
          addressType={recipient.addressDeriveInfo?.label}
          address={recipient.input ?? ''}
          isLocal={!!(recipient.walletAccountName || recipient.addressBookName)}
          showAccount
          showHierarchyIndicator
          showType={
            vaultSettings?.mergeDeriveAssetsEnabled ||
            recipient.addressDeriveType !== 'default'
          }
          onPress={() => {
            onSelect?.({ address: recipient.input ?? '' });
          }}
        />
      ))}
    </Stack>
  );
}

export default RecentRecipients;
