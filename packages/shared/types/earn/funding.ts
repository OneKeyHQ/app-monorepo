export type IEarnFundingIntent = {
  intentAmount?: string;
  positionBefore?: string;
  swapRecovery?: IEarnSwapRecovery;
};

export type IEarnSwapRecovery = {
  sender: IEarnSwapRecoverySide;
  receiver: IEarnSwapRecoverySide;
  provider: { provider: string; providerName: string; providerLogo?: string };
  serviceOrderId?: string;
  orderId?: string;
  useOrderId: boolean;
  ctx?: unknown;
  currency: { id: string; symbol: string };
  createdAt: number;
};

export type IEarnSwapRecoverySide = {
  accountId: string;
  networkId: string;
  address: string;
  amount: string;
  token: {
    networkId: string;
    contractAddress: string;
    symbol: string;
    decimals: number;
    isNative?: boolean;
    name?: string;
    logoURI?: string;
  };
};

export type IEarnFundingReceipt = { scope: string; txId: string };

export type IEarnFundingState = (
  | { status: 'unknown'; txIdConflict?: true }
  | { status: 'submitted'; txId: string }
  | { status: 'funded'; txId: string; receivedAmount: string }
) &
  IEarnFundingIntent & { source?: IEarnFundingReceipt };

export type IEarnFundingChange =
  | ({
      type: 'claim';
      attemptId: string;
      group?: string;
      source?: IEarnFundingReceipt;
      startsGroup?: true;
    } & IEarnFundingIntent)
  | { type: 'submitted'; attemptId: string; txId: string }
  | { type: 'settled'; txId: string; receivedAmount: string }
  | { type: 'cancelled'; attemptId: string }
  | { type: 'clear'; txId: string; status: 'submitted' | 'funded' }
  | { type: 'complete'; txId: string; keepDestination?: true };
