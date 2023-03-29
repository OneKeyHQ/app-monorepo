export type ContactValues = {
  networkId?: string;
  name: string;
  address: string;
};

export enum AddressBookRoutes {
  NewAddressRoute = 'NewAddressRoute',
  EditAddressRoute = 'EditAddressRoute',
  PickAddressRoute = 'PickAddressRoute',
  EnterAddressRoute = 'EnterAddressRoute',
  NewPickAddressRoute = 'NewPickAddressRoute',
}

export type AddressBookRoutesParams = {
  [AddressBookRoutes.NewAddressRoute]:
    | {
        address: string;
        possibleNetworks?: string[];
      }
    | undefined;
  [AddressBookRoutes.PickAddressRoute]:
    | {
        networkId?: string;
        onSelected?: (data: { address: string; name?: string }) => void;
      }
    | undefined;
  [AddressBookRoutes.EnterAddressRoute]:
    | {
        networkId?: string;
        onSelected?: (data: { address: string; name?: string }) => void;
        defaultAddress?: string;
      }
    | undefined;
  [AddressBookRoutes.EditAddressRoute]: {
    uuid: number;
    defaultValues: ContactValues;
  };
  [AddressBookRoutes.NewPickAddressRoute]:
    | {
        networkId?: string;
        onSelected?: (data: { address: string; name?: string }) => void;
      }
    | undefined;
};
