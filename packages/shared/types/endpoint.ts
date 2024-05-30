export enum EServiceEndpointEnum {
  Wallet = 'wallet',
  Swap = 'swap',
  Utility = 'utility',
  Lightning = 'lightning',
  Earn = 'earn',
}

export type IEndpointEnv = 'test' | 'prod';

export type IServiceEndpoint = {
  wallet: string;
  swap: string;
  utility: string;
  lightning: string;
  earn: string;
};

export type IEndpointDomainWhiteList = string[];
