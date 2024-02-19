import type { IAddressItem } from '../type';

export enum EModalAddressBookRoutes {
  ListItemModal = 'ListItemModal',
  AddItemModal = 'AddItemModal',
  EditItemModal = 'EditItemModal',
  PickItemModal = 'PickItemModal',
}

export type IModalAddressBookParamList = {
  [EModalAddressBookRoutes.ListItemModal]: undefined;
  [EModalAddressBookRoutes.AddItemModal]: undefined;
  [EModalAddressBookRoutes.EditItemModal]: IAddressItem;
  [EModalAddressBookRoutes.PickItemModal]: {
    networkId?: string;
    onPick?: (item: IAddressItem) => void;
  };
};
