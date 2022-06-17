import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItem, SectionListRenderItem } from 'react-native';

import {
  Badge,
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  SegmentedControl,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import imageUrl from '../../../../assets/3d_contact.png';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WalletAvatar from '../../../components/Header/WalletAvatar';
import { useAppSelector } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { Contact } from '../../../store/reducers/contacts';
import { AddressBookRoutes, AddressBookRoutesParams } from '../routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  AddressBookRoutesParams,
  AddressBookRoutes.PickAddressRoute
>;

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.PickAddressRoute
>;

const AddressBook = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const contacts = useAppSelector((s) => s.contacts.contacts);
  const items = useMemo(() => {
    let values = Object.values(contacts);
    values = values.sort((a, b) => (a.createAt > b.createAt ? -1 : -1));
    if (networkId) {
      const badge = networkId.split('--')[0];
      values = values.filter(
        (item) => item.badge.toUpperCase() === badge.toUpperCase(),
      );
    }
    return values;
  }, [contacts, networkId]);

  const onPress = useCallback(
    (item: { address: string; name?: string }) => {
      onSelected?.({ address: item.address, name: item.name });
      navigation.goBack();
    },
    [onSelected, navigation],
  );

  const renderItem: ListRenderItem<Contact> = useCallback(
    ({ item, index }) => (
      <Pressable
        p="4"
        flexDirection="row"
        alignItems="center"
        bg="surface-default"
        borderTopLeftRadius={index === 0 ? '12' : undefined}
        borderTopRightRadius={index === 0 ? '12' : undefined}
        borderBottomLeftRadius={index === items.length - 1 ? '12' : undefined}
        borderBottomRightRadius={index === items.length - 1 ? '12' : undefined}
        onPress={() => onPress(item)}
      >
        <Box
          w="8"
          h="8"
          borderRadius="full"
          bg="decorative-surface-one"
          justifyContent="center"
          alignItems="center"
        >
          <Typography.DisplaySmall color="text-default">
            {item.name.toUpperCase()[0]}
          </Typography.DisplaySmall>
        </Box>
        <Box flex="1" mx="4">
          <Box flexDirection="row">
            <Typography.Body2Strong mr="2" numberOfLines={1}>
              {item.name}
            </Typography.Body2Strong>
            <Badge size="sm" title={item.badge.toUpperCase()} />
          </Box>
          <Box>
            <Typography.Body2 color="text-subdued" numberOfLines={2}>
              {item.address}
            </Typography.Body2>
          </Box>
        </Box>
      </Pressable>
    ),
    [items, onPress],
  );

  const listEmptyComponent = useMemo(
    () => (
      <Center w="full" h="full">
        <Empty
          title={intl.formatMessage({ id: 'title__no_cantact' })}
          subTitle={intl.formatMessage({ id: 'title__no_cantact_desc' })}
          imageUrl={imageUrl}
        />
      </Center>
    ),
    [intl],
  );

  return (
    <FlatList
      ListEmptyComponent={listEmptyComponent}
      data={items}
      ItemSeparatorComponent={() => <Divider />}
      renderItem={renderItem}
      keyExtractor={(item) => item.address}
    />
  );
};

type WalletAccount = {
  wallet: Wallet;
  data: Account[];
};

const MyWallet = () => {
  const { wallets } = useRuntime();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const [sections, setSections] = useState<WalletAccount[]>([]);
  useEffect(() => {
    async function main() {
      for (let i = 0; i < wallets.length; i += 1) {
        const wallet = wallets[i];
        const accounts = await backgroundApiProxy.engine.getAccounts(
          wallet.accounts,
          networkId,
        );
        if (accounts && accounts.length > 0) {
          setSections((prev) => [
            ...prev,
            { wallet, data: accounts, key: wallet.id },
          ]);
        }
      }
    }
    main();
    // eslint-disable-next-line
  }, []);

  const onPress = useCallback(
    (item: { address: string; name?: string }) => {
      onSelected?.({ address: item.address, name: item.name });
      navigation.goBack();
    },
    [onSelected, navigation],
  );

  const renderItem: SectionListRenderItem<Account, WalletAccount> = ({
    item,
    section,
    index,
  }) => (
    <Pressable
      flexDirection="row"
      p="4"
      bg="surface-default"
      borderTopLeftRadius={index === 0 ? '12' : undefined}
      borderTopRightRadius={index === 0 ? '12' : undefined}
      borderBottomLeftRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      borderBottomRightRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      onPress={() => onPress({ address: item.address, name: item.name })}
    >
      <Box mr="3">
        <WalletAvatar
          avatar={section.wallet.avatar}
          walletImage={section.wallet.type}
        />
      </Box>
      <Box>
        <Typography.Body1 color="text-default">{item.name}</Typography.Body1>
        <Typography.Body2 color="text-subdued">
          {utils.shortenAddress(item.address)}
        </Typography.Body2>
      </Box>
    </Pressable>
  );
  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Divider />}
      renderSectionHeader={({ section: { wallet } }) => (
        // eslint-disable-next-line
        <Typography.Subheading my="2">{wallet.name}</Typography.Subheading>
      )}
    />
  );
};

const PickAddress = () => {
  const intl = useIntl();
  const [optionValue, setOptionValue] = useState<string>('AddressBook');
  const navigation = useNavigation<NavigationProps>();
  const onPrimaryPress = useCallback(() => {
    navigation.navigate(AddressBookRoutes.NewAddressRoute);
  }, [navigation]);
  const wallet = useMemo(() => <MyWallet />, []);
  const addressbook = useMemo(() => <AddressBook />, []);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__select_contact' })}
      hideSecondaryAction
      primaryActionTranslationId="action__add_new_address"
      primaryActionProps={{
        leftIconName: 'PlusSolid',
        type: 'basic',
        onPress: onPrimaryPress,
      }}
      hidePrimaryAction={optionValue !== 'AddressBook'}
    >
      <Box mb="6">
        <SegmentedControl
          containerProps={{
            width: 'full',
          }}
          options={[
            {
              label: intl.formatMessage({ id: 'title__address_book' }),
              value: 'AddressBook',
            },
            {
              label: intl.formatMessage({ id: 'form__my_wallet' }),
              value: 'Wallet',
            },
          ]}
          onChangeValue={setOptionValue}
          defaultValue={optionValue}
        />
      </Box>
      <Box flex="1">{optionValue === 'AddressBook' ? addressbook : wallet}</Box>
    </Modal>
  );
};

export default PickAddress;
