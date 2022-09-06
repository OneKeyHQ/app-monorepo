/* eslint-disable no-nested-ternary */
import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  SectionList,
  Text,
} from '@onekeyhq/components';

import Header from './Header';
import ListItem from './ListItem';

const WalletSelectorGallery = () => {
  const intl = useIntl();

  function sectionHeaderLabel(type: string) {
    if (type === 'hd') return intl.formatMessage({ id: 'wallet__app_wallet' });
    if (type === 'hw')
      return intl.formatMessage({ id: 'wallet__hardware_wallet' });
    return intl.formatMessage({ id: 'content__other' });
  }

  const DATA = [
    {
      type: 'hd',
      data: [
        {
          walletImage: '🤑',
          bgColor: '#E3B167',
          name: 'Wallet #1',
          isActive: true,
        },
        {
          walletImage: '🌈',
          bgColor: '#91BC76',
          name: 'Wallet #2',
          isActive: false,
        },
      ],
    },
    {
      type: 'hw',
      data: [
        {
          walletImage: 'hw',
          hwWalletType: 'classic',
          name: 'My Classic',
          isActive: false,
          status: 'connected',
        },
        {
          walletImage: 'hw',
          hwWalletType: 'mini',
          name: 'My Mini',
          isActive: false,
          hiddenWallets: ['Hidden Wallet #1', 'Hidden Wallet #2'],
        },
      ],
    },
    {
      type: 'other',
      data: [
        {
          walletImage: 'imported',
          name: intl.formatMessage({ id: 'wallet__imported_accounts' }),
          isActive: false,
          NumberOfAccounts: '2',
        },
        {
          walletImage: 'watching',
          name: intl.formatMessage({ id: 'wallet__watched_accounts' }),
          isActive: false,
          NumberOfAccounts: '3',
        },
        {
          walletImage: 'external',
          name: intl.formatMessage({ id: 'content__external_account' }),
          isActive: false,
          NumberOfAccounts: '4',
        },
      ],
    },
  ];

  const WalletSelectorChild = () => (
    <Box bgColor="background-default" alignSelf="stretch" flex={1}>
      <Header title={intl.formatMessage({ id: 'title__wallets' })} />
      <SectionList
        sections={DATA}
        keyExtractor={(item, index) => item + index}
        renderItem={({ item }) => (
          <>
            {item.hiddenWallets?.length ? (
              <Box rounded="16px" bgColor="surface-subdued">
                <ListItem
                  walletImage={item.walletImage}
                  hwWalletType={item.hwWalletType}
                  avatarBgColor={item.bgColor}
                  circular={!item.isActive}
                  name={item.name}
                  status={item.status}
                />
                {item.hiddenWallets?.map((hiddenWalletName) => (
                  <ListItem
                    key={hiddenWalletName}
                    walletImage={item.walletImage}
                    hwWalletType={item.hwWalletType}
                    avatarBgColor={item.bgColor}
                    circular={!item.isActive}
                    name={hiddenWalletName}
                    status={item.status}
                    isPassphrase
                  />
                ))}
                <Box p={2}>
                  <IconButton name="PlusOutline" />
                </Box>
              </Box>
            ) : (
              <ListItem
                walletImage={item.walletImage}
                hwWalletType={item.hwWalletType}
                avatarBgColor={item.bgColor}
                circular={!item.isActive}
                name={item.name}
                status={item.status}
                NumberOfAccounts={item.NumberOfAccounts}
              />
            )}
          </>
        )}
        renderSectionHeader={({ section: { type } }) => (
          <Text typography="Subheading" color="text-subdued" px={2} mb={1}>
            {sectionHeaderLabel(type)}
          </Text>
        )}
        style={{ padding: '8px' }}
        ItemSeparatorComponent={() => <Box h={1} />}
        renderSectionFooter={() => <Box h={6} />}
      />
    </Box>
  );

  return (
    <Center flex="1" bg="backdrop">
      <Box w="306px" h="600px">
        <WalletSelectorChild />
      </Box>
    </Center>
  );
};

export default WalletSelectorGallery;
