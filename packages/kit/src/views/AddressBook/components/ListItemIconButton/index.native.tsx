import { useIntl } from 'react-intl';

import { ActionList, useClipboard } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

import type { IListItemIconButtonProps } from './type';

export const ListItemIconButton = ({ item }: IListItemIconButtonProps) => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const appNavigation = useAppNavigation();
  return (
    <ListItem.IconButton
      onPress={() => {
        ActionList.show({
          title: intl.formatMessage({
            id: ETranslations.address_book_menu_title,
          }),
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.global_copy,
              }),
              icon: 'Copy3Outline',
              onPress: async () => {
                copyText(item.address);
              },
              testID: `address-menu-copy-${item.address ?? ''}`,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.global_edit,
              }),
              icon: 'PencilOutline',
              onPress: () => {
                if (item.id) {
                  appNavigation.push(EModalAddressBookRoutes.EditItemModal, {
                    id: item.id,
                    name: item.name,
                    address: item.address,
                    networkId: item.networkId,
                  });
                }
              },
              testID: `address-menu-edit-${item.address ?? ''}`,
            },
          ],
        });
      }}
      icon="DotVerSolid"
      testID={`address-menu-${item.address || ''}`}
    />
  );
};
