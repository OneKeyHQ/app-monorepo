import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';

export enum ECustomInjectedModalRoutes {
  ProtocolList = 'CustomInjectedProtocolList',
  E2EWorkflow = 'CustomInjectedE2EWorkflow',
  E2EErrorDetail = 'CustomInjectedE2EErrorDetail',
  OperationLogs = 'CustomInjectedOperationLogs',
}

export type ICustomInjectedE2EOutcome = {
  passed: boolean;
  text: string;
  errorLog?: string;
};

export type ICustomInjectedModalParamList = {
  [ECustomInjectedModalRoutes.ProtocolList]: {
    selectedProtocolId: string;
    sessionId: string;
  };
  [ECustomInjectedModalRoutes.E2EWorkflow]: {
    e2eOutcome?: ICustomInjectedE2EOutcome;
    protocolId: string;
    protocolName: string;
    recordingPhase?: 'preparing' | 'recording' | 'stopping' | 'saving';
    sessionId: string;
  };
  [ECustomInjectedModalRoutes.E2EErrorDetail]: {
    errorLog: string;
    protocolName: string;
  };
  [ECustomInjectedModalRoutes.OperationLogs]: {
    sessionId: string;
  };
};

type ISharedDiscoveryModalNavigationParams = {
  screen: keyof IDiscoveryModalParamList;
  params?: IDiscoveryModalParamList[keyof IDiscoveryModalParamList];
};

export function buildCustomInjectedModalParams<TRoute extends ECustomInjectedModalRoutes>(
  screen: TRoute,
  params: ICustomInjectedModalParamList[TRoute],
): ISharedDiscoveryModalNavigationParams {
  return { screen, params } as unknown as ISharedDiscoveryModalNavigationParams;
}
