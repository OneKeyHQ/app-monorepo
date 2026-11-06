import type { IAggregateToken, IHomeDefaultToken } from './token';

export type IClearCacheOnAppState = {
  oneKeyId: boolean;
  tokenAndNFT: boolean;
  transactionHistory: boolean;
  swapHistory: boolean;
  browserCache: boolean;
  appUpdateCache: boolean;
  browserHistory: boolean;
  customToken: boolean;
  customRpc: boolean;
  customNetworkFee: boolean;
  serverNetworks: boolean;
  connectSites: boolean;
  signatureRecord: boolean;
  perpsData?: boolean;
};

export enum EReasonForNeedPassword {
  CreateOrRemoveWallet = 'CreateOrRemoveWallet',
  CreateTransaction = 'CreateTransaction',
  LightningNetworkAuth = 'LightningNetworkAuth',
  Security = 'Security',
  Default = 'Default', // Default is for the case that the reason is not specified
}

/**
 * Wallet config
 */

export type IFetchWalletConfigResp = {
  data: {
    meta: {
      homeDefaults: IHomeDefaultToken[];
      approvalResurfaceDays: number;
      approvalAlertResurfaceDays: number;
    };
    tokens: Record<
      string,
      {
        logoURI: string;
        name: string;
        data: IAggregateToken[];
      }
    >;
  };
};

export type ITermsConsentSource =
  | 'onboarding'
  | 'wallet_ready'
  | 'dialog'
  | 'web_connect';

// One prompting round per required terms version on this install.
export type ITermsConsentRound = {
  version: string;
  firstPromptAt: number;
  notNowAt?: number;
};

export type ITermsConsentState = {
  acceptedVersion?: string;
  round?: ITermsConsentRound;
};

export type ITermsConsentPrompt = {
  version: string;
  deadlineAt: number;
  deadlinePassed: boolean;
};
