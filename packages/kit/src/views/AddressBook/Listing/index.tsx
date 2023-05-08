import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Empty,
  IconButton,
  List,
  ListItem,
  Modal,
  ToastManager,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { useAppSelector } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
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
  const { bottom } = useSafeAreaInsets();

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
          onLongPress={() => {
            onCopy(address);
          }}
          onPress={() => onPress(item)}
        >
          <ListItem.Column>
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
          </ListItem.Column>
          <ListItem.Column
            flex={1}
            text={{
              label: (
                <Box flexDirection="row" alignItems="center">
                  <Typography.Body1Strong mr="8px" isTruncated>
                    {name}
                  </Typography.Body1Strong>
                  <Badge size="sm" title={badge.toUpperCase()} />
                </Box>
              ),
              description: (
                <Typography.Body2 color="text-subdued">
                  {address}
                </Typography.Body2>
              ),
            }}
          />

          <ListItem.Column>
            <AddressBookMenu contact={item}>
              <IconButton name="EllipsisVerticalMini" circle type="plain" />
            </AddressBookMenu>
          </ListItem.Column>
        </ListItem>
      );
    },
    [onCopy, onPress],
  );

  return data.length === 0 ? (
    <Center w="full" h="full">
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
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListFooterComponent={bottom > 0 ? <Box h={`${bottom}px`} /> : null}
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
          name="PlusCircleOutline"
          type="plain"
          size="lg"
          circle
        />
      }
      header={intl.formatMessage({ id: 'title__contacts' })}
      hideSecondaryAction
      footer={null}
      height="480px"
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
