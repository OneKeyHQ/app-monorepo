export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
  BookmarkListModal = 'BookmarkListModal',
  HistoryListModal = 'HistoryListModal',
  CustomInjectedProtocolList = 'CustomInjectedProtocolList',
  CustomInjectedE2EWorkflow = 'CustomInjectedE2EWorkflow',
  CustomInjectedE2EErrorDetail = 'CustomInjectedE2EErrorDetail',
  CustomInjectedOperationLogs = 'CustomInjectedOperationLogs',
}

export type ICustomInjectedE2EOutcome = {
  passed: boolean;
  text: string;
  errorLog?: string;
};

export type IDiscoveryModalParamList = {
  [EDiscoveryModalRoutes.MobileTabList]: undefined;
  [EDiscoveryModalRoutes.SearchModal]: {
    tabId?: string;
    useCurrentWindow?: boolean;
    url: string;
  };
  [EDiscoveryModalRoutes.BookmarkListModal]: undefined;
  [EDiscoveryModalRoutes.HistoryListModal]: undefined;
  [EDiscoveryModalRoutes.CustomInjectedProtocolList]: {
    selectedProtocolId: string;
    sessionId: string;
  };
  [EDiscoveryModalRoutes.CustomInjectedE2EWorkflow]: {
    e2eOutcome?: ICustomInjectedE2EOutcome;
    protocolId: string;
    protocolName: string;
    recordingPhase?: 'preparing' | 'recording' | 'stopping' | 'saving';
    sessionId: string;
  };
  [EDiscoveryModalRoutes.CustomInjectedE2EErrorDetail]: {
    errorLog: string;
    protocolName: string;
  };
  [EDiscoveryModalRoutes.CustomInjectedOperationLogs]: {
    sessionId: string;
  };
};
