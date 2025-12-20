import { memo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAddressBookRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { urlAccountNavigation } from '../../../Home/pages/urlAccount/urlAccountUtils';

import type { IListItemIconButtonProps } from './type';

export function BasicListItemIconButton({
  id,
  address,
}: Pick<IListItemIconButtonProps['item'], 'id' | 'address'>) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const appNavigation = useAppNavigation();
  const safeAddress = address ?? '';
  return (
    <ActionList
      title={intl.formatMessage({
        id: ETranslations.address_book_menu_title,
      })}
      items={[
        {
          label: intl.formatMessage({ id: ETranslations.global_copy_address }),
          icon: 'Copy3Outline',
          onPress: async () => {
            if (safeAddress) {
              copyText(safeAddress);
            }
          },
          testID: `address-menu-copy-${safeAddress}`,
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_edit }),
          icon: 'PencilOutline',
          onPress: () => {
            if (id) {
              appNavigation.push(EModalAddressBookRoutes.EditItemModal, {
                id,
              });
            }
          },
          testID: `address-menu-edit-${safeAddress}`,
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_portfolio }),
          icon: 'PeopleOutline',
          onPress: async () => {
            if (id) {
              const { password } =
                await backgroundApiProxy.servicePassword.promptPasswordVerify();
              if (!password) {
                return;
              }
              const addressBookItem =
                await backgroundApiProxy.serviceAddressBook.findItemById({
                  id,
                  password,
                });
              if (addressBookItem) {
                // appNavigation.pushModal(EModalRoutes.MainModal, {
                //   screen: ETabHomeRoutes.TabHomeUrlAccountPage,
                //   params: {
                //     address: addressBookItem.address,
                //     networkId: addressBookItem.networkId,
                //   },
                // });
                appNavigation.switchTab(ETabRoutes.Home);
                void urlAccountNavigation.pushUrlAccountPage(appNavigation, {
                  address: addressBookItem.address,
                  networkId: addressBookItem.networkId,
                });
              }
            }
          },
          testID: `address-menu-portfolio-${safeAddress}`,
        },
      ]}
      renderTrigger={
        <ListItem.IconButton
          icon="DotVerSolid"
          testID={`address-menu-${safeAddress}`}
        />
      }
    />
  );
}

export const ListItemIconButton = memo(
  BasicListItemIconButton,
  (prev, next) => prev.id === next.id && prev.address === next.address,
);
