export enum ETabHomeRoutes {
  TabHome = 'TabHome',
  TabHomeUrlAccountPage = 'TabHomeUrlAccountPage',
  TabHomeUrlAccountLanding = 'TabHomeUrlAccountLanding',
  TabHomeReferralLanding = 'TabHomeReferralLanding',
}

export type ITabHomeUrlAccountParamList = {
  [ETabHomeRoutes.TabHomeUrlAccountPage]: {
    networkId: string;
    address: string;
  };
};

export type ITabHomeParamList = {
  [ETabHomeRoutes.TabHome]: undefined;
  [ETabHomeRoutes.TabHomeUrlAccountLanding]: {
    networkId: string;
    address: string;
  };
  [ETabHomeRoutes.TabHomeReferralLanding]: {
    code: string;
    page: string;
  };
} & ITabHomeUrlAccountParamList;
