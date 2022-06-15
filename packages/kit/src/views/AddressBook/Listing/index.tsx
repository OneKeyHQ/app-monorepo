import React, { FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  IconButton,
  Pressable,
  Select,
  Typography,
  useIsSmallLayout,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import imageUrl from '../../../../assets/3d_contact.png';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { Contact, remove } from '../../../store/reducers/contacts';
import { AddressBookRoutes } from '../routes';

import Layout from './layout';

type ListingItemValues = {
  name: string;
  badge: string;
  address: string;
  networkId: string;
  id: number;
};

const ListingItem: FC<ListingItemValues> = ({
  name,
  badge,
  address,
  id,
  networkId,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const isSmall = useIsSmallLayout();
  const navigation = useNavigation();
  const onEdit = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.EditAddressRoute,
        params: {
          uuid: id,
          defaultValues: { name, address, networkId },
        },
      },
    });
  }, [navigation, name, address, networkId, id]);
  const onCopy = useCallback(() => {
    copyToClipboard(address);
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [toast, intl, address]);
  const onDel = useCallback(() => {
    backgroundApiProxy.dispatch(remove({ uuid: id }));
  }, [id]);

  return (
    <Pressable
      p="4"
      flexDirection="row"
      alignItems="center"
      onLongPress={onCopy}
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
          {name.toUpperCase()[0]}
        </Typography.DisplaySmall>
      </Box>
      <Box flex="1" mx="4">
        <Box flexDirection="row">
          <Typography.Body2Strong mr="2" numberOfLines={1}>
            {name}
          </Typography.Body2Strong>
          <Badge size="sm" title={badge} />
        </Box>
        <Box>
          <Typography.Body2 color="text-subdued" numberOfLines={2}>
            {address}
          </Typography.Body2>
        </Box>
      </Box>
      <Select
        onChange={(value) => {
          switch (value) {
            case 'Edit': {
              onEdit();
              break;
            }
            case 'Duplicate': {
              onCopy();
              break;
            }
            case 'Delete': {
              onDel();
              break;
            }
            default: {
              //
            }
          }
        }}
        activatable={false}
        dropdownPosition="right"
        footer={null}
        title={name}
        headerShown={false}
        containerProps={{ width: 'auto' }}
        dropdownProps={{
          width: 248,
        }}
        options={[
          {
            label: intl.formatMessage({ id: 'action__edit' }),
            value: 'Edit',
            iconProps: {
              name: isSmall ? 'PencilOutline' : 'PencilSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__copy_address' }),
            value: 'Duplicate',
            iconProps: {
              name: isSmall ? 'DuplicateOutline' : 'DuplicateSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__delete' }),
            value: 'Delete',
            iconProps: {
              name: isSmall ? 'TrashOutline' : 'TrashSolid',
            },
            destructive: true,
          },
        ]}
        renderTrigger={() => (
          <IconButton
            pointerEvents="none"
            name="DotsHorizontalSolid"
            type="plain"
          />
        )}
      />
    </Pressable>
  );
};

const Listing = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const contacts = useAppSelector((s) => s.contacts.contacts);
  const data = useMemo(() => {
    let values = Object.values(contacts);
    values = values.sort((a, b) => (a.createAt > b.createAt ? -1 : -1));
    return values;
  }, [contacts]);
  const onNew = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.NewAddressRoute,
      },
    });
  }, [navigation]);
  return data.length === 0 ? (
    <Center w="full" h="full" bg="background-default">
      <Empty
        title={intl.formatMessage({ id: 'title__no_cantact' })}
        subTitle={intl.formatMessage({ id: 'title__no_cantact_desc' })}
        actionTitle={intl.formatMessage({ id: 'action__add_new_address' })}
        actionProps={{ leftIconName: 'PlusSolid' }}
        handleAction={onNew}
        imageUrl={imageUrl}
      />
    </Center>
  ) : (
    <Layout onNew={onNew}>
      <Box bg="surface-default" borderRadius={12}>
        <FlatList<Contact>
          data={data}
          renderItem={({ item }) => (
            <ListingItem
              name={item.name}
              badge={item.badge.toUpperCase()}
              address={item.address}
              id={item.id}
              networkId={item.networkId}
            />
          )}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(item) => String(item.id)}
        />
      </Box>
    </Layout>
  );
};

export default Listing;
