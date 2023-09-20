import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { remove } from '../../../store/reducers/contacts';
import BaseMenu from '../../Overlay/BaseMenu';
import { AddressBookRoutes } from '../routes';

import type { Contact } from '../../../store/reducers/contacts';
import type { IMenu } from '../../Overlay/BaseMenu';
import type { MessageDescriptor } from 'react-intl';

type Props = IMenu & { contact: Contact };
const AddressBookMenu: FC<Props> = ({ contact, ...props }) => {
  const intl = useIntl();
  const { name, address, networkId, id } = contact;
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
    setTimeout(() => {
      copyToClipboard(address);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__address_copied' }),
      });
    }, 200);
  }, [intl, address]);

  const onDel = useCallback(() => {
    backgroundApiProxy.dispatch(remove({ uuid: id }));
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__address_deleted' }),
    });
  }, [id, intl]);

  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
        variant?: 'desctructive' | 'highlight';
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      {
        id: 'action__edit',
        onPress: onEdit,
        icon: 'PencilMini',
      },
      {
        id: 'action__copy_address',
        onPress: onCopy,
        icon: 'Square2StackOutline',
      },
      {
        id: 'action__delete',
        onPress: onDel,
        icon: 'TrashMini',
        variant: 'desctructive',
      },
    ],
    [onCopy, onDel, onEdit],
  );
  return <BaseMenu w={190} options={options} {...props} />;
};

export default AddressBookMenu;
