export enum RootModalRoutes {
  DemoCreateModal = 'DemoCreateModalStack',
  DemoLockedModal = 'DemoLockedModalStack',
  DemoCoverageModal = 'DemoCoverageModalStack',
}

export type DemoRootModalParamList = {
  [RootModalRoutes.DemoCreateModal]: DemoCreateModalParamList;
  [RootModalRoutes.DemoLockedModal]: DemoLockedModalParamList;
  [RootModalRoutes.DemoCoverageModal]: DemoCoverageModalParamList;
};

export enum DemoCreateModalRoutes {
  DemoCreateModal = 'DemoCreateModal',
  DemoCreateSearchModal = 'DemoCreateSearchModal',
  DemoCreateOptionsModal = 'DemoCreateOptionsModal',
  DemoBigListModal = 'DemoBigListModal',
}

export type DemoCreateModalParamList = {
  [DemoCreateModalRoutes.DemoCreateModal]: { question: string };
  [DemoCreateModalRoutes.DemoCreateSearchModal]: { question: string };
  [DemoCreateModalRoutes.DemoCreateOptionsModal]: { question: string };
  [DemoCreateModalRoutes.DemoBigListModal]: undefined;
};

export enum DemoLockedModalRoutes {
  DemoLockedModal = 'DemoLockedModal',
  DemoConfigLockedModal = 'DemoConfigLockedModal',
  DemoManualLockedViewModal = 'DemoManualLockedViewModal',
  DemoRepeatManualLockedViewModal = 'DemoRepeatManualLockedViewModal',
}

export type DemoLockedModalParamList = {
  [DemoLockedModalRoutes.DemoLockedModal]: undefined;
  [DemoLockedModalRoutes.DemoConfigLockedModal]: undefined;
  [DemoLockedModalRoutes.DemoManualLockedViewModal]: undefined;
  [DemoLockedModalRoutes.DemoRepeatManualLockedViewModal]: undefined;
};

export enum DemoCoverageModalRoutes {
  DemoCoverageModal = 'DemoCoverageModal',
  DemoCoverageDialogModal = 'DemoCoverageDialogModal',
  DemoCoverageModalModal = 'DemoCoverageModalModal',
}

export type DemoCoverageModalParamList = {
  [DemoCoverageModalRoutes.DemoCoverageModal]: undefined;
  [DemoCoverageModalRoutes.DemoCoverageDialogModal]: undefined;
  [DemoCoverageModalRoutes.DemoCoverageModalModal]: undefined;
};
