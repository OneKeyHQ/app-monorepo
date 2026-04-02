export enum ERootModalRoutes {
  DemoCreateModal = 'DemoCreateModalStack',
  DemoLockedModal = 'DemoLockedModalStack',
  DemoCoverageModal = 'DemoCoverageModalStack',
}

export type IDemoRootModalParamList = {
  [ERootModalRoutes.DemoCreateModal]: IDemoCreateModalParamList;
  [ERootModalRoutes.DemoLockedModal]: IDemoLockedModalParamList;
  [ERootModalRoutes.DemoCoverageModal]: IDemoCoverageModalParamList;
};

export enum EDemoCreateModalRoutes {
  DemoCreateModal = 'DemoCreateModal',
  DemoCreateSearchModal = 'DemoCreateSearchModal',
  DemoCreateOptionsModal = 'DemoCreateOptionsModal',
  DemoBigListModal = 'DemoBigListModal',
}

export type IDemoCreateModalParamList = {
  [EDemoCreateModalRoutes.DemoCreateModal]: { question: string };
  [EDemoCreateModalRoutes.DemoCreateSearchModal]: { question: string };
  [EDemoCreateModalRoutes.DemoCreateOptionsModal]: { question: string };
  [EDemoCreateModalRoutes.DemoBigListModal]: undefined;
};

export enum EDemoLockedModalRoutes {
  DemoLockedModal = 'DemoLockedModal',
  DemoConfigLockedModal = 'DemoConfigLockedModal',
  DemoManualLockedViewModal = 'DemoManualLockedViewModal',
  DemoRepeatManualLockedViewModal = 'DemoRepeatManualLockedViewModal',
  DemoShouldPopOnClickBackdropViewModal = 'DemoShouldPopOnClickBackdropViewModal',
}

export type IDemoLockedModalParamList = {
  [EDemoLockedModalRoutes.DemoLockedModal]: undefined;
  [EDemoLockedModalRoutes.DemoConfigLockedModal]: undefined;
  [EDemoLockedModalRoutes.DemoManualLockedViewModal]: undefined;
  [EDemoLockedModalRoutes.DemoRepeatManualLockedViewModal]: undefined;
  [EDemoLockedModalRoutes.DemoShouldPopOnClickBackdropViewModal]: undefined;
};

export enum EDemoCoverageModalRoutes {
  DemoCoverageModal = 'DemoCoverageModal',
  DemoCoverageDialogModal = 'DemoCoverageDialogModal',
  DemoCoverageModalModal = 'DemoCoverageModalModal',
}

export type IDemoCoverageModalParamList = {
  [EDemoCoverageModalRoutes.DemoCoverageModal]: undefined;
  [EDemoCoverageModalRoutes.DemoCoverageDialogModal]: undefined;
  [EDemoCoverageModalRoutes.DemoCoverageModalModal]: undefined;
};
