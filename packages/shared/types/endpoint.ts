export enum EServiceEndpointEnum {
  Wallet = 'wallet',
  Swap = 'swap',
  Utility = 'utility',
  Lightning = 'lightning',
  Earn = 'earn',
  Notification = 'notification',
  NotificationWebSocket = 'notificationWebSocket',
}

export type IEndpointEnv = 'test' | 'prod';

export type IServiceEndpoint = {
  [K in EServiceEndpointEnum]: string;
};

export type IEndpointDomainWhiteList = string[];

export type IEndpointInfo = {
  endpoint: string;
  name: EServiceEndpointEnum;
  autoHandleError?: boolean;
};

export type IApiClientResponse<T> = {
  code: number;
  data: T;
  message: string;
};
