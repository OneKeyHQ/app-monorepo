export enum EModalBulkCopyAddressesRoutes {
  BulkCopyAddressesModal = 'BulkCopyAddressesModal',
  ExportAddresses = 'ExportAddresses',
}

export type IModalBulkCopyAddressesParamList = {
  [EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal]: {
    walletId?: string;
    networkId?: string;
  };
};

export type IModalBulkCopyAddressesExportAddressesParamList = {
  [EModalBulkCopyAddressesRoutes.ExportAddresses]: {
    walletId: string;
    networkId: string;
  };
};
