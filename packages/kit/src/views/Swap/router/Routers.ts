export enum EModalSwapRoutes {
  SwapTokenSelect = 'SwapTokenSelect',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapTokenSelect]: { type: 'from' | 'to' };
};
