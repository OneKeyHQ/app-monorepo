import type { Types } from 'tronweb';

export type IEncodedTxTron = Types.Transaction;

export type IDecodedTxExtraTron = {
  energyUsage?: number;
  energyFee?: number;
  energyUsageTotal?: number;
  netUsage?: number;
};
