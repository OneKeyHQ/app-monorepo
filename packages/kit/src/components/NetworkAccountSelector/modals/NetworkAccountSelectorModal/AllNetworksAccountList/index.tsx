import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, List, useSafeAreaInsets } from '@onekeyhq/components';

import { useActiveWalletAccount, useDebounce } from '../../../../../hooks';
import { useAllNetworksAccountsData } from '../../../hooks/useAccountSelectorSectionData';

import AllNetworksListItem from './AllNetworksListItem';

import type { useAccountSelectorInfo } from '../../../hooks/useAccountSelectorInfo';

const separator = () => <Box h={2} />;

function AllNetwroksAccountList({
  accountSelectorInfo,
  searchValue,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  searchValue: string;
}) {
  const terms = useDebounce(searchValue, 500);
  const intl = useIntl();

  const { isOpenDelay } = accountSelectorInfo;
  const { data } = useAllNetworksAccountsData({
    accountSelectorInfo,
  });

  const { accountId: activeAccountId } = useActiveWalletAccount();

  const dataSource = useMemo(
    () => data.filter((item) => item.name.toLowerCase().includes(terms)),
    [data, terms],
  );

  const insets = useSafeAreaInsets();

  // for performance: do NOT render UI if selector not open
  if (!isOpenDelay) {
    return null;
  }

  return (
    <List
      initialNumToRender={20}
      m={0}
      data={dataSource}
      keyExtractor={(item) => item.id}
      renderItem={({
        item,
      }: {
        item: {
          id: string;
          name: string;
          index: number;
        };
      }) => (
        <AllNetworksListItem
          label={item.name}
          isActive={item.id === activeAccountId}
          accountId={item.id}
          networkId={accountSelectorInfo.selectedNetworkId ?? ''}
          walletId={accountSelectorInfo.selectedWalletId ?? ''}
        />
      )}
      ItemSeparatorComponent={separator}
      ListEmptyComponent={
        <Empty
          emoji="💳"
          title={intl.formatMessage({ id: 'empty__no_account_title' })}
          subTitle={intl.formatMessage({
            id: 'empty__no_account_desc',
          })}
          flex={1}
          mt={8}
        />
      }
      ListFooterComponent={<Box h={`${insets.bottom}px`} />}
      px={{ base: 2, md: 4 }}
    />
  );
}

export default AllNetwroksAccountList;
