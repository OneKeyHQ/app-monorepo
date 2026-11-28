import type { IAddressItem } from '@onekeyhq/shared/types/addressBook';

export enum EModalAddressBookRoutes {
  ListItemModal = 'ListItemModal',
  EditItemModal = 'EditItemModal',
  PickItemModal = 'PickItemModal',
}

export type IModalAddressBookParamList = {
  [EModalAddressBookRoutes.ListItemModal]: undefined;
  [EModalAddressBookRoutes.EditItemModal]: IAddressItem & {
    onSaveSuccess?: () => void;
  };
  [EModalAddressBookRoutes.PickItemModal]: {
    networkId?: string;
    onPick?: (item: IAddressItem) => void;
  };
};
