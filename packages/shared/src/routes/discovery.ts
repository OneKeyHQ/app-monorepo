export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
  BookmarkListModal = 'BookmarkListModal',
  HistoryListModal = 'HistoryListModal',
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
  CustomInjectedProtocolList: {
    selectedProtocolId: string;
    sessionId: string;
  };
  CustomInjectedE2EWorkflow: {
    e2eOutcome?: ICustomInjectedE2EOutcome;
    protocolId: string;
    protocolName: string;
    recordingPhase?: 'preparing' | 'recording' | 'stopping' | 'saving';
    sessionId: string;
  };
  CustomInjectedE2EErrorDetail: {
    errorLog: string;
    protocolName: string;
  };
  CustomInjectedOperationLogs: {
    sessionId: string;
  };
};
