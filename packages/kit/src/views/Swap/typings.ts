export enum SwapRoutes {
  Swap = 'Swap',
  Input = 'Input',
  Output = 'Output',
  Settings = 'Settings',
  CustomToken = 'CustomToken',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.CustomToken]: { address?: string } | undefined;
};

export type SwapQuote = {
  price: string;
  guaranteedPrice: string;
  to: string;
  data?: string;
  value?: string;
  gasPrice?: string;
  gas?: string;
  estimatedGas?: string;
  protocolFee?: string;
  minimumProtocolFee?: string;
  buyAmount: string;
  sellAmount: string;
  sources?: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  estimatedGasTokenRefund?: string;
  allowanceTarget: string;
};
