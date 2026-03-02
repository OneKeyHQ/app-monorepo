import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export enum ETabHomeRoutes {
  TabHome = 'TabHome',
  TabHomeUrlAccountPage = 'TabHomeUrlAccountPage',
  TabHomeUrlAccountLanding = 'TabHomeUrlAccountLanding',
  TabHomeReferralLanding = 'TabHomeReferralLanding',
  TabHomeReferralLandingWithoutPage = 'TabHomeReferralLandingWithoutPage',
  TabHomeReferralLandingCodeOnly = 'TabHomeReferralLandingCodeOnly',
  TabHomeBulkSendAddressesInput = 'TabHomeBulkSendAddressesInput',
  TabHomeBulkSendAmountsInput = 'TabHomeBulkSendAmountsInput',
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
    isInModal?: boolean;
  };
  [ETabHomeRoutes.TabHomeBulkSendAmountsInput]: {
    networkId: string;
    accountId: string | undefined;
    senders: {
      address: string;
      amount: string | undefined;
    }[];
    receivers: { address: string; amount: string | undefined }[];
    tokenInfo: IToken;
    tokenDetails: { info: IToken } & ITokenFiat;
    bulkSendMode: EBulkSendMode;
    isInModal?: boolean;
  };
} & ITabHomeUrlAccountParamList;
