export enum EModalBulkExportHistoryRoutes {
  BulkExportHistoryModal = 'BulkExportHistoryModal',
}

export type IModalBulkExportHistoryParamList = {
  [EModalBulkExportHistoryRoutes.BulkExportHistoryModal]: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string | undefined;
    walletId: string | undefined;
  };
};
