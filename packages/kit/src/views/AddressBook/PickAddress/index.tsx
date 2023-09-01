import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

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
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet, WalletType } from '@onekeyhq/engine/src/types/wallet';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WalletAvatar from '../../../components/WalletSelector/WalletAvatar';
import { useAppSelector } from '../../../hooks/redux';
import { useContacts } from '../hooks';
import { AddressBookRoutes } from '../routes';

import type { AddressBookRoutesParams } from '../routes';
import type { Contact } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem, SectionListRenderItem } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  AddressBookRoutesParams,
  AddressBookRoutes.PickAddressRoute
>;

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.PickAddressRoute
>;

const ItemSeparatorComponent = () => (
  <Box mx={{ base: 4, md: 6 }}>
    <Divider />
  </Box>
);

const AddressBook = ({
  addressFilter,
}: {
  addressFilter?: (address: string) => Promise<boolean>;
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const contacts = useContacts();

  const [listData, updateListData] = useState<Contact[]>([]);
  const filterContacts = useCallback(
    async (values: Contact[]): Promise<Contact[]> => {
      if (addressFilter) {
        const promises = values.map(async (a) => {
          const isVaild = await addressFilter(a.address);
          return { value: a, isVaild };
        });
        const datasIncludeIsVaild = await Promise.all(promises);
        return datasIncludeIsVaild
          .filter((value) => value.isVaild)
          .map((data) => data.value);
      }
      return Promise.resolve(values);
    },
    [addressFilter],
  );

  useEffect(() => {
    async function main() {
      let values = contacts;
      if (networkId) {
        const badge = networkId.split('--')[0];
        values = values.filter(
          (item) => item.badge.toUpperCase() === badge.toUpperCase(),
        );
      }
      values = await filterContacts(values);
      if (values && values.length > 0) {
        updateListData(values);
      }
    }
    main();
  }, [contacts, filterContacts, networkId]);

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
        py="4"
        px="4"
        mx={{ base: 4, md: 6 }}
        flexDirection="row"
        alignItems="center"
        bg="surface-default"
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={index === listData.length - 1 ? '12' : undefined}
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
          <Typography.DisplaySmall color="decorative-icon-one">
            {item.name.toUpperCase()[0]}
          </Typography.DisplaySmall>
        </Box>
        <Box flex="1" ml="4">
          <Box flexDirection="row">
            <Typography.Body1Strong mr="2" numberOfLines={1} maxWidth="80%">
              {item.name}
            </Typography.Body1Strong>
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
    [listData, onPress],
  );

  const listEmptyComponent = useMemo(
    () => (
      <Center w="full" h="full">
        <Empty
          title={intl.formatMessage({ id: 'title__no_cantact' })}
          subTitle={intl.formatMessage({ id: 'title__no_cantact_desc' })}
          emoji="📇"
        />
      </Center>
    ),
    [intl],
  );

  return (
    <FlatList
      ListEmptyComponent={listEmptyComponent}
      data={listData}
      ItemSeparatorComponent={ItemSeparatorComponent}
      renderItem={renderItem}
      keyExtractor={(item) => item.address}
    />
  );
};

type WalletAccount = {
  wallet: Wallet;
  data: Account[];
};

const MyWallet = ({
  addressFilter,
  walletsToHide,
}: {
  addressFilter?: (address: string) => Promise<boolean>;
  walletsToHide?: WalletType[];
}) => {
  const intl = useIntl();
  const wallets = useAppSelector((s) => s.runtime.wallets);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const [sections, setSections] = useState<WalletAccount[]>([]);

  const filterAccounts = useCallback(
    async (accounts: Account[]): Promise<Account[]> => {
      if (addressFilter) {
        const promises = accounts.map(async (a) => {
          const isVaild = await addressFilter(a.address);
          return { value: a, isVaild };
        });
        const datasIncludeIsVaild = await Promise.all(promises);
        return datasIncludeIsVaild
          .filter((value) => value.isVaild)
          .map((data) => data.value);
      }
      return Promise.resolve(accounts);
    },
    [addressFilter],
  );

  useEffect(() => {
    // TODO make it a hook and use promise.all (same logic in pickrecipient)
    async function main() {
      for (let i = 0; i < wallets.length; i += 1) {
        const wallet = wallets[i];
        if (!walletsToHide?.includes(wallet.type)) {
          let accounts = await backgroundApiProxy.engine.getAccounts(
            wallet.accounts,
            networkId,
          );
          accounts = await filterAccounts(accounts);

          if (accounts && accounts.length > 0) {
            setSections((prev) => [
              ...prev,
              { wallet, data: accounts, key: wallet.id },
            ]);
          }
        }
      }
    }
    main();
    // eslint-disable-next-line
  }, [filterAccounts]);

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
      mx={{ base: 4, md: 6 }}
      borderTopLeftRadius={index === 0 ? '12' : undefined}
      borderTopRightRadius={index === 0 ? '12' : undefined}
      borderBottomLeftRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      borderBottomRightRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      onPress={() => onPress({ address: item.address, name: item.name })}
      alignItems="center"
    >
      <Box mr="3" key={item.address}>
        <WalletAvatar
          avatar={section.wallet.avatar}
          walletImage={section.wallet.type}
          hwWalletType={
            (section.wallet.deviceType as IOneKeyDeviceType) ||
            getDeviceTypeByDeviceId(section.wallet.associatedDevice)
          }
          isPassphrase={isPassphraseWallet(section.wallet)}
          size="sm"
        />
      </Box>
      <Box flex="1">
        <Typography.Body1Strong color="text-default" numberOfLines={1}>
          {item.name}
        </Typography.Body1Strong>
        <Typography.Body2 color="text-subdued">
          {shortenAddress(item.address)}
        </Typography.Body2>
      </Box>
    </Pressable>
  );

  const renderWalletTitle = useCallback(
    (wallet: Wallet) => {
      if (wallet.type === 'external') {
        return intl.formatMessage({ id: 'content__external_account' });
      }
      if (wallet.type === 'imported') {
        return intl.formatMessage({ id: 'wallet__imported_accounts' });
      }
      if (wallet.type === 'watching') {
        return intl.formatMessage({ id: 'wallet__watched_accounts' });
      }
      return wallet.name;
    },
    [intl],
  );
  return (
    <SectionList
      stickySectionHeadersEnabled={false}
      sections={sections}
      contentContainerStyle={{ flexGrow: 1 }}
      keyExtractor={(item: Account, index) => `${item.address}${index}`}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      // eslint-disable-next-line
      renderSectionHeader={({ section }: { section: WalletAccount }) => (
        <Typography.Subheading my="2" mx={{ base: 4, md: 6 }}>
          {renderWalletTitle(section.wallet)}
        </Typography.Subheading>
      )}
    />
  );
};

const PickAddress = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { addressFilter, contactExcludeWalletAccount, walletsToHide } =
    route.params ?? {};

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const navigation = useNavigation<NavigationProps>();
  const onPrimaryPress = useCallback(() => {
    navigation.navigate(AddressBookRoutes.NewAddressRoute);
  }, [navigation]);
  const wallet = useMemo(
    () => (
      <MyWallet addressFilter={addressFilter} walletsToHide={walletsToHide} />
    ),
    [addressFilter, walletsToHide],
  );
  const addressbook = useMemo(
    () => <AddressBook addressFilter={addressFilter} />,
    [addressFilter],
  );
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__select_contact' })}
      hideSecondaryAction
      footer={selectedIndex === 0 ? undefined : null}
      primaryActionTranslationId="action__add_new_address"
      primaryActionProps={{
        leftIconName: 'PlusMini',
        type: 'basic',
        onPress: onPrimaryPress,
      }}
      maxHeight="560px"
      hidePrimaryAction={selectedIndex !== 0}
      staticChildrenProps={{ flex: 1, py: 6 }}
    >
      <Box mb="6" px={{ base: 4, md: 6 }}>
        {!contactExcludeWalletAccount ? (
          <SegmentedControl
            values={[
              intl.formatMessage({ id: 'title__address_book' }),
              intl.formatMessage({ id: 'form__my_wallet' }),
            ]}
            selectedIndex={selectedIndex}
            onChange={setSelectedIndex}
          />
        ) : null}
      </Box>
      <Box flex="1">{selectedIndex === 0 ? addressbook : wallet}</Box>
    </Modal>
  );
};

export default PickAddress;
