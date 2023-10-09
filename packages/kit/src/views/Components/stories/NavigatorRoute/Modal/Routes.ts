export enum RootModalRoutes {
  DemoCreateModal = 'DemoCreateModalStack',
  DemoLockedModal = 'DemoLockedModalStack',
}

export type DemoRootModalParamList = {
  [RootModalRoutes.DemoCreateModal]: DemoCreateModalParamList;
  [RootModalRoutes.DemoLockedModal]: DemoLockedModalParamList;
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
}

export type DemoLockedModalParamList = {
  [DemoLockedModalRoutes.DemoLockedModal]: undefined;
  [DemoLockedModalRoutes.DemoConfigLockedModal]: undefined;
  [DemoLockedModalRoutes.DemoManualLockedViewModal]: undefined;
};
