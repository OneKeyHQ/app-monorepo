export type IEarnFundingIntent = {
  intentAmount?: string;
  positionBefore?: string;
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
