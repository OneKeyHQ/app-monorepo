/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC, Key } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  SectionList,
  Text,
  VStack,
} from '@onekeyhq/components';

import ListItem from './ListItem';

type BodyProps = {};

const defaultProps = {} as const;

const Body: FC<BodyProps> = () => {
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

  return (
    <SectionList
      // @ts-ignore
      sections={DATA}
      keyExtractor={(item, index) => `${item.name}${index}`}
      renderSectionHeader={({ section: { type, data } }) => (
        <>
          {/* Hidden section header if there is no wallet item in the current category */}
          {data?.length ? (
            <Text typography="Subheading" color="text-subdued" px={2} mb={1}>
              {sectionHeaderLabel(type)}
            </Text>
          ) : undefined}
        </>
      )}
      renderItem={({ item }) => (
        <>
          {/* Grouping wallet items if they have nested hidden wallets */}
          {/* @ts-ignore */}
          {item.hiddenWallets?.length ? (
            <VStack space={1} rounded="16px" bgColor="surface-subdued">
              <ListItem
                walletImage={item.walletImage}
                // @ts-ignore
                hwWalletType={item.hwWalletType}
                avatarBgColor={item.bgColor}
                circular={!item.isActive}
                name={item.name}
                // @ts-ignore
                status={item.status}
              />
              {/* @ts-ignore */}
              {item.hiddenWallets?.map(
                (
                  hiddenWalletName: string | undefined,
                  index: Key | null | undefined,
                ) => (
                  <ListItem
                    key={index}
                    walletImage={item.walletImage}
                    // @ts-ignore
                    hwWalletType={item.hwWalletType}
                    avatarBgColor={item.bgColor}
                    circular={!item.isActive}
                    name={hiddenWalletName}
                    // @ts-ignore
                    status={item.status}
                    isPassphrase
                  />
                ),
              )}
              <Box p={2}>
                <Pressable
                  rounded="xl"
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="center"
                  p={2}
                  borderWidth={1}
                  borderColor="border-default"
                  borderStyle="dashed"
                  _hover={{ bgColor: 'surface-hovered' }}
                  _pressed={{ bgColor: 'surface-pressed' }}
                >
                  <Icon name="PlusSmMini" size={20} />
                  <Text ml={2} typography="Body2Strong">
                    {intl.formatMessage({ id: 'action__add_hidden_wallet' })}
                  </Text>
                </Pressable>
              </Box>
            </VStack>
          ) : (
            <ListItem
              walletImage={item.walletImage}
              // @ts-ignore
              hwWalletType={item.hwWalletType}
              avatarBgColor={item.bgColor}
              circular={!item.isActive}
              name={item.name}
              // @ts-ignore
              status={item.status}
              // @ts-ignore
              NumberOfAccounts={item.NumberOfAccounts}
            />
          )}
        </>
      )}
      ItemSeparatorComponent={() => <Box h={1} />} // The spacing between items within a section
      renderSectionFooter={() => <Box h={6} />} // The spacing between sections
      style={{ padding: '8px' }}
    />
  );
};

Body.defaultProps = defaultProps;

export default Body;
