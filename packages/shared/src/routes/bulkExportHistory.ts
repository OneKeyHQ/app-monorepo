export enum EModalBulkExportHistoryRoutes {
  BulkExportHistoryModal = 'BulkExportHistoryModal',
  BulkExportHistorySelectNetworks = 'BulkExportHistorySelectNetworks',
}

export type IModalBulkExportHistoryParamList = {
  [EModalBulkExportHistoryRoutes.BulkExportHistoryModal]: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string | undefined;
    walletId: string | undefined;
  };
  [EModalBulkExportHistoryRoutes.BulkExportHistorySelectNetworks]: {
    supportedNetworkIds: string[];
    selectedNetworkIds: string[];
    onSelectedNetworkIdsChange?: (networkIds: string[]) => void;
  };
};
