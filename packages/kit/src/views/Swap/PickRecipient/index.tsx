import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
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
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WalletAvatar from '../../../components/WalletSelector/WalletAvatar';
import { useAppSelector } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { SwapRoutes } from '../typings';

import type { Contact } from '../../../store/reducers/contacts';
import type { SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem, SectionListRenderItem } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  SwapRoutesParams,
  SwapRoutes.PickRecipient
>;

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.PickRecipient>;

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
        py="4"
        px="4"
        mx={{ base: 4, md: 6 }}
        flexDirection="row"
        alignItems="center"
        bg="surface-default"
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={index === items.length - 1 ? '12' : undefined}
        borderBottomWidth={index === items.length - 1 ? 1 : 0}
        borderWidth={1}
        borderColor="divider"
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
    [items, onPress],
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
      data={items}
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
    // TODO make it a hook and use promise.all (same logic in pickaddress)
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
    (item: { address: string; name?: string; accountId?: string }) => {
      onSelected?.({
        address: item.address,
        name: item.name,
        accountId: item.accountId,
      });
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
      borderBottomWidth={index === section.data.length - 1 ? 1 : 0}
      borderWidth={1}
      borderColor="divider"
      onPress={() =>
        onPress({ address: item.address, name: item.name, accountId: item.id })
      }
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
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item: Account, index) => `${item.address}${index}`}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      // eslint-disable-next-line
      renderSectionHeader={({ section }: { section: WalletAccount }) => (
        <Typography.Subheading
          my="2"
          mx={{ base: 4, md: 6 }}
          color="text-subdued"
        >
          {section.wallet.name}
        </Typography.Subheading>
      )}
    />
  );
};

const PickRecipient = () => {
  const intl = useIntl();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const onPrimaryPress = useCallback(() => {
    navigation.navigate(SwapRoutes.EnterAddress, { networkId, onSelected });
  }, [navigation, networkId, onSelected]);
  const wallet = useMemo(() => <MyWallet />, []);
  const addressbook = useMemo(() => <AddressBook />, []);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__choose_an_account' })}
      hideSecondaryAction
      footer={selectedIndex === 0 ? undefined : null}
      primaryActionTranslationId="form__enter_address"
      primaryActionProps={{
        leftIconName: 'PencilMini',
        type: 'basic',
        onPress: onPrimaryPress,
      }}
      maxHeight="560"
      hidePrimaryAction={selectedIndex !== 0}
      staticChildrenProps={{ flex: 1, py: 6 }}
    >
      <Box mb="6" px={{ base: 4, md: 6 }}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'form__my_wallet' }),
            intl.formatMessage({ id: 'title__address_book' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>
      <Box flex="1">{selectedIndex === 0 ? wallet : addressbook}</Box>
    </Modal>
  );
};

export default PickRecipient;
