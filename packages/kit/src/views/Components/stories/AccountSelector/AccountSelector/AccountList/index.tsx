/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC } from 'react';

import { Box, SectionList } from '@onekeyhq/components';

import ListItem from './ListItem';
import SectionHeader from './SectionHeader';

type AccountListProps = {};

const defaultProps = {} as const;

const AccountList: FC<AccountListProps> = () => {
  const DATA = [
    {
      wallet: 'Wallet #1',
      data: [
        {
          label: 'EVM #1',
          address: '0xadE9...A57b',
          balance: '$251215.72',
          isActive: true,
        },
        {
          label: 'EVM #2',
          address: '0xadE9...A57b',
          balance: '$0.00',
        },
      ],
    },
    {
      wallet: 'Wallet #2',
      data: [],
    },
  ];

  return (
    <SectionList
      sections={DATA}
      keyExtractor={(item) => item.address}
      renderSectionHeader={({ section: { wallet, data } }) => (
        <SectionHeader walletName={wallet} emptySectionData={!data?.length} />
      )}
      renderItem={({ item }) => (
        <ListItem
          isActive={item.isActive}
          label={item.label}
          address={item.address}
          balance={item.balance}
        />
      )}
      ItemSeparatorComponent={() => <Box h={2} />}
      renderSectionFooter={() => <Box h={6} />}
      style={{ padding: 8 }}
    />
  );
};

AccountList.defaultProps = defaultProps;

export default AccountList;
