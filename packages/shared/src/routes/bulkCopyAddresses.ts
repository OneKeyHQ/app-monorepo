export enum EModalBulkCopyAddressesRoutes {
  BulkCopyAddressesModal = 'BulkCopyAddressesModal',
}

export type IModalBulkCopyAddressesParamList = {
  [EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal]: {
    walletId?: string;
    networkId?: string;
  };
};
