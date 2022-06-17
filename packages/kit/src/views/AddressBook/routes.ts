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
}

export type AddressBookRoutesParams = {
  [AddressBookRoutes.NewAddressRoute]: undefined;
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
      }
    | undefined;
  [AddressBookRoutes.EditAddressRoute]: {
    uuid: number;
    defaultValues: ContactValues;
  };
};
