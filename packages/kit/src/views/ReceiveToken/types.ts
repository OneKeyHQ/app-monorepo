export enum ReceiveTokenRoutes {
  ReceiveToken = 'ReceiveToken',
}

export type ReceiveTokenRoutesParams = {
  [ReceiveTokenRoutes.ReceiveToken]: { address: string; name: string };
};
