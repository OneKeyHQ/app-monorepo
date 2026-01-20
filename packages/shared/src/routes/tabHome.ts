import type { IToken } from "@onekeyhq/shared/types/token";

export enum ETabHomeRoutes {
  TabHome = "TabHome",
  TabHomeUrlAccountPage = "TabHomeUrlAccountPage",
  TabHomeUrlAccountLanding = "TabHomeUrlAccountLanding",
  TabHomeReferralLanding = "TabHomeReferralLanding",
  TabHomeReferralLandingWithoutPage = "TabHomeReferralLandingWithoutPage",
  TabHomeReferralLandingCodeOnly = "TabHomeReferralLandingCodeOnly",
  TabHomeBulkSendAddressesInput = "TabHomeBulkSendAddressesInput",
  TabHomeBulkSendAmountsInput = "TabHomeBulkSendAmountsInput",
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
  [ETabHomeRoutes.TabHomeBulkSendAddressesInput]: {
    networkId: string | undefined;
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    tokenInfo?: IToken;
  };
  [ETabHomeRoutes.TabHomeBulkSendAmountsInput]: {
    networkId: string;
    accountId: string;
    senderAddresses: string[];
    receiverAddressesWithAmounts: { address: string; amount: string }[];
    tokenInfo: IToken;
  };
} & ITabHomeUrlAccountParamList;
