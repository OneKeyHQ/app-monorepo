import type { Transaction } from 'tronweb';

export type IEncodedTxTron = Transaction;

export type IDecodedTxExtraTron = {
  energyUsage?: number;
  energyFee?: number;
  energyUsageTotal?: number;
  netUsage?: number;
};
