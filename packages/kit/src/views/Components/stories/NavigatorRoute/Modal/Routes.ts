export enum RootModalRoutes {
  DemoCreateModal = 'DemoCreateModalStack',
  DemoDoneModal = 'DemoDoneModalStack',
}

export type DemoRootModalParamList = {
  [RootModalRoutes.DemoCreateModal]: DemoCreateModalParamList;
  [RootModalRoutes.DemoDoneModal]: DemoDoneModalParamList;
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

export enum DemoDoneModalRoutes {
  DemoDoneModal = 'DemoDoneModal',
  DemoDone1Modal = 'DemoDone1Modal',
}

export type DemoDoneModalParamList = {
  [DemoDoneModalRoutes.DemoDoneModal]: undefined;
  [DemoDoneModalRoutes.DemoDone1Modal]: undefined;
};
