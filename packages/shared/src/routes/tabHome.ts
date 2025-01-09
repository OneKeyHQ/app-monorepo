export enum ETabHomeRoutes {
  TabHome = 'TabHome',
  TabHomeUrlAccountPage = 'TabHomeUrlAccountPage',
  TabHomeUrlAccountLanding = 'TabHomeUrlAccountLanding',
}

export type ITabHomeParamList = {
  [ETabHomeRoutes.TabHome]: undefined;
  [ETabHomeRoutes.TabHomeUrlAccountPage]: {
    networkId: string;
    address: string;
  };
  [ETabHomeRoutes.TabHomeUrlAccountLanding]: {
    networkId: string;
    address: string;
  };
};
