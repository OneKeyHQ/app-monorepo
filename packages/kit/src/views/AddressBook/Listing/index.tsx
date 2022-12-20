import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  IconButton,
  Select,
  Typography,
  useIsVerticalLayout,
  useTheme,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { remove } from '../../../store/reducers/contacts';
import { AddressBookRoutes } from '../routes';

import Layout from './layout';

type ListingItemValues = {
  name: string;
  badge: string;
  address: string;
  networkId: string;
  id: number;
  index: number;
  total: number;
};

const ListingItem: FC<ListingItemValues> = ({
  name,
  badge,
  address,
  id,
  networkId,
  index,
  total,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const { themeVariant } = useTheme();
  const isVertical = useIsVerticalLayout();
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
    toast.show({ title: intl.formatMessage({ id: 'msg__address_copied' }) });
  }, [toast, intl, address]);
  const onDel = useCallback(() => {
    backgroundApiProxy.dispatch(remove({ uuid: id }));
    toast.show({ title: intl.formatMessage({ id: 'msg__address_deleted' }) });
  }, [id, toast, intl]);

  const onLongPress = useCallback(() => {
    onCopy();
  }, [onCopy]);

  return (
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
            name: isVertical ? 'PencilOutline' : 'PencilMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'action__copy_address' }),
          value: 'Duplicate',
          iconProps: {
            name: isVertical ? 'Square2StackOutline' : 'Square2StackMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'action__delete' }),
          value: 'Delete',
          iconProps: {
            name: isVertical ? 'TrashOutline' : 'TrashMini',
          },
          destructive: true,
        },
      ]}
      triggerProps={{ onLongPress }}
      renderTrigger={() => (
        <Box
          p="4"
          flexDirection="row"
          alignItems="center"
          borderLeftWidth={0.5}
          borderRightWidth={0.5}
          borderTopWidth={index === 0 ? '0.5' : undefined}
          borderBottomWidth={index === total - 1 ? '0.5' : undefined}
          borderTopRadius={index === 0 ? '12' : undefined}
          borderBottomRadius={index === total - 1 ? '12' : undefined}
          borderColor={
            themeVariant === 'light' ? 'border-subdued' : 'transparent'
          }
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
              {name.toUpperCase()[0]}
            </Typography.DisplaySmall>
          </Box>
          <Box flex="1" mx="4">
            <Box flexDirection="row">
              <Typography.Body1Strong mr="2" numberOfLines={1}>
                {name}
              </Typography.Body1Strong>
              <Badge size="sm" title={badge} />
            </Box>
            <Box>
              <Typography.Body2 color="text-subdued" numberOfLines={2}>
                {address}
              </Typography.Body2>
            </Box>
          </Box>
          <IconButton
            pointerEvents="none"
            name="DotsHorizontalMini"
            type="plain"
          />
        </Box>
      )}
    />
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

  useEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'title__address_book' }),
    });
  }, [navigation, intl]);

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
    <Layout onNew={onNew}>
      <Box bg="surface-default" borderRadius={12}>
        <FlatList
          data={data}
          renderItem={({ item, index }) => (
            <ListingItem
              name={item.name}
              badge={item.badge.toUpperCase()}
              address={item.address}
              id={item.id}
              networkId={item.networkId}
              index={index}
              total={data.length}
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
