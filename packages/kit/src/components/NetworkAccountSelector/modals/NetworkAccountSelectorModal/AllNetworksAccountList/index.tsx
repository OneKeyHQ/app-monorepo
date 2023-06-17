import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, List, useSafeAreaInsets } from '@onekeyhq/components';

import { useAppSelector, useDebounce } from '../../../../../hooks';
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

  const accountIndex = useAppSelector((s) => s.allNetworks.accountIndex);

  const { isOpenDelay } = accountSelectorInfo;
  const { data } = useAllNetworksAccountsData({
    accountSelectorInfo,
  });

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
      keyExtractor={(item) => item.name}
      renderItem={({
        item,
      }: {
        item: {
          name: string;
          index: number;
        };
      }) => (
        <AllNetworksListItem
          label={item.name}
          isActive={item.index === accountIndex}
          accountIndex={item.index}
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
