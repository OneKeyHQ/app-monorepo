export enum EModalBulkExportHistoryRoutes {
  BulkExportHistoryModal = 'BulkExportHistoryModal',
  BulkExportHistoryTaskCreated = 'BulkExportHistoryTaskCreated',
  BulkExportHistoryTaskList = 'BulkExportHistoryTaskList',
  BulkExportHistoryTaskDetail = 'BulkExportHistoryTaskDetail',
}

export type IModalBulkExportHistoryParamList = {
  [EModalBulkExportHistoryRoutes.BulkExportHistoryModal]: {
    // The home network seeds a normal entry; the account is always re-derived
    // from the home scene inside the page.
    networkId: string | undefined;
    // When starting another export from a task, preserve its complete network
    // selection instead of reducing a multi-network task to the first network.
    selectedNetworkIds?: string[];
    // A task opened from the filtered history list can restore that list's
    // selected account. Notification entries omit this, so account-sensitive
    // restart actions are not offered for them.
    accountSelectorSceneUrl?: string;
  };
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated]: undefined;
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList]: undefined;
  [EModalBulkExportHistoryRoutes.BulkExportHistoryTaskDetail]: {
    taskId: number;
    selectedNetworkIds?: string[];
    accountSelectorSceneUrl?: string;
  };
};
