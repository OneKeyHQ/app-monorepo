export enum EModalBulkExportHistoryRoutes {
  BulkExportHistoryModal = 'BulkExportHistoryModal',
  BulkExportHistoryTaskCreated = 'BulkExportHistoryTaskCreated',
}

export type IModalBulkExportHistoryParamList = {
  [EModalBulkExportHistoryRoutes.BulkExportHistoryModal]: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string | undefined;
    walletId: string | undefined;
  };
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated]: undefined;
};
