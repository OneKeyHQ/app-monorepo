import type { IToken } from '@onekeyhq/shared/types/token';

export enum ETabHomeRoutes {
  TabHome = 'TabHome',
  TabHomeUrlAccountPage = 'TabHomeUrlAccountPage',
  TabHomeUrlAccountLanding = 'TabHomeUrlAccountLanding',
  TabHomeReferralLanding = 'TabHomeReferralLanding',
  TabHomeReferralLandingWithoutPage = 'TabHomeReferralLandingWithoutPage',
  TabHomeReferralLandingCodeOnly = 'TabHomeReferralLandingCodeOnly',
  TabHomeBulkSend = 'TabHomeBulkSend',
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
  [ETabHomeRoutes.TabHomeReferralLandingWithoutPage]: {
    code: string;
    page?: string;
  };
  [ETabHomeRoutes.TabHomeReferralLandingCodeOnly]: {
    code: string;
  };
  [ETabHomeRoutes.TabHomeBulkSend]: {
    networkId: string | undefined;
    accountId: string | undefined;
    tokenInfo?: IToken;
  };
} & ITabHomeUrlAccountParamList;
