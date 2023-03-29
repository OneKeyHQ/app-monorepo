import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Empty,
  Icon,
  IconButton,
  List,
  ListItem,
  Modal,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { useAppSelector } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { AddressBookRoutes } from '../routes';

import AddressBookMenu from './menu';

import type { Contact } from '../../../store/reducers/contacts';
import type { AddressBookRoutesParams } from '../routes';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  AddressBookRoutesParams,
  AddressBookRoutes.NewPickAddressRoute
>;

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.NewPickAddressRoute
>;

type ListProps = {
  onNew?: () => void;
  networkId?: string;
  onSelected?: (data: { address: string; name?: string }) => void;
};

const AddressList = ({ networkId, onNew, onSelected }: ListProps) => {
  const intl = useIntl();
  const contacts = useAppSelector((s) => s.contacts.contacts);

  const data = useMemo(() => {
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

  const onCopy = useCallback(
    (address: string) => {
      copyToClipboard(address);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__address_copied' }),
      });
    },
    [intl],
  );

  const navigation = useNavigation<NavigationProps>();

  const onPress = useCallback(
    (item: { address: string; name?: string }) => {
      if (onSelected) {
        onSelected?.({ address: item.address, name: item.name });
        navigation.goBack();
      }
    },
    [onSelected, navigation],
  );

  const renderItem: ListRenderItem<Contact> = useCallback(
    ({ item }) => {
      const { name, badge, address } = item;
      return (
        <ListItem
          px={0}
          py={0}
          my={0}
          onLongPress={() => {
            onCopy(address);
          }}
          onPress={() => onPress(item)}
        >
          <Box
            w="40px"
            h="40px"
            borderRadius="full"
            bg="decorative-surface-one"
            justifyContent="center"
            alignItems="center"
          >
            <Typography.Body2 color="decorative-icon-one">
              {name.toUpperCase()[0]}
            </Typography.Body2>
          </Box>
          <Box flex="1">
            <Box flexDirection="row" mb="4px">
              <Typography.Body1Strong mr="8px" numberOfLines={1}>
                {name}
              </Typography.Body1Strong>
              <Badge size="sm" title={badge.toUpperCase()} />
            </Box>
            <Typography.Body2 color="text-subdued" numberOfLines={2}>
              {address}
            </Typography.Body2>
          </Box>
          <AddressBookMenu contact={item}>
            <Pressable
              width="36px"
              height="36px"
              justifyContent="center"
              alignItems="center"
            >
              <Icon size={20} name="EllipsisVerticalMini" />
            </Pressable>
          </AddressBookMenu>
        </ListItem>
      );
    },
    [onCopy, onPress],
  );
  const ItemSeparatorComponent = useCallback(() => <Box h="16px" />, []);

  return data.length === 0 ? (
    <Center w="full" h="full" bg="background-default">
      <Empty
        title={intl.formatMessage({ id: 'title__no_cantact' })}
        subTitle={intl.formatMessage({ id: 'title__no_cantact_desc' })}
        actionTitle={intl.formatMessage({ id: 'action__add_new_address' })}
        actionProps={{ leftIconName: 'PlusMini' }}
        handleAction={onNew}
        emoji="📇"
      />
    </Center>
  ) : (
    <List
      m={0}
      p="16px"
      data={data}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      keyExtractor={(item) => String(item.id)}
    />
  );
};

const AddressBookModal = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const navigation = useNavigation<NavigationProps>();

  const onNew = useCallback(() => {
    navigation.navigate(AddressBookRoutes.NewAddressRoute);
  }, [navigation]);

  return (
    <Modal
      rightContent={
        <IconButton
          onPress={onNew}
          width="40px"
          height="40px"
          name="PlusCircleOutline"
          type="plain"
        />
      }
      header={intl.formatMessage({ id: 'title__select_contact' })}
      hideSecondaryAction
      footer={null}
      maxHeight="560px"
      height="560px"
      staticChildrenProps={{ flex: 1 }}
    >
      <AddressList
        networkId={networkId}
        onSelected={onSelected}
        onNew={onNew}
      />
    </Modal>
  );
};

export function useAddressBook() {
  const navigation = useNavigation();

  const showAddressBookModal = useCallback(
    (params?: {
      networkId?: string;
      onSelected?: (data: { address: string; name?: string }) => void;
    }) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.AddressBook,
        params: {
          screen: AddressBookRoutes.NewPickAddressRoute,
          params,
        },
      });
    },
    [navigation],
  );

  return { showAddressBookModal };
}

export default AddressBookModal;
