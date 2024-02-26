import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { EModalAddressBookRoutes } from './types';

import type { IModalAddressBookParamList } from './types';

const AddressBookListModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/common/components/AddressBook/pages/ListItem'),
);

const AddressBookAddItemModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/common/components/AddressBook/pages/AddItem'),
);

const AddressBookEditItemModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/common/components/AddressBook/pages/EditItem'),
);

const AddressBookPickItemModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/common/components/AddressBook/pages/PickItem'),
);

export const ModalAddressBookRouter: IModalFlowNavigatorConfig<
  EModalAddressBookRoutes,
  IModalAddressBookParamList
>[] = [
  {
    name: EModalAddressBookRoutes.ListItemModal,
    component: AddressBookListModal,
    translationId: 'title__address_book',
  },
  {
    name: EModalAddressBookRoutes.AddItemModal,
    component: AddressBookAddItemModal,
    translationId: 'title__address_book',
  },
  {
    name: EModalAddressBookRoutes.EditItemModal,
    component: AddressBookEditItemModal,
    translationId: 'title__address_book',
  },
  {
    name: EModalAddressBookRoutes.PickItemModal,
    component: AddressBookPickItemModal,
    translationId: 'title__address_book',
  },
];
