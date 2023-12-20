export enum EEndpointName {
  Http = 'http',
  WebSocket = 'websocket',
}

export type IEndpointEnv = 'test' | 'prod';

export type IEndpoint = {
  http: string;
  websocket: string;
};

export type IEndpointDomainWhiteList = string[];
