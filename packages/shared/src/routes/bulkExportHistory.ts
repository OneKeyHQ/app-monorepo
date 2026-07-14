export enum EModalBulkExportHistoryRoutes {
  BulkExportHistoryModal = 'BulkExportHistoryModal',
  BulkExportHistoryTaskCreated = 'BulkExportHistoryTaskCreated',
  BulkExportHistoryTaskList = 'BulkExportHistoryTaskList',
}

export type IModalBulkExportHistoryParamList = {
  [EModalBulkExportHistoryRoutes.BulkExportHistoryModal]: {
    // Only the home network is needed to seed the default network selection;
    // the account is re-derived from the home scene inside the page.
    networkId: string | undefined;
  };
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated]: undefined;
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList]: undefined;
};
