export enum EModalSwapRoutes {
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapTokenSelect = 'SwapTokenSelect',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapNetworkSelect]: { type: 'from' | 'to' };
  [EModalSwapRoutes.SwapTokenSelect]: { type: 'from' | 'to' };
};
