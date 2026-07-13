import { z } from 'zod';

import { chainId, ethAddress } from './common';

export const signInputSchema = z.object({
  chain: chainId.optional().describe('Target chain. Defaults to eth.'),
  tx: z.string().min(1).describe('JSON encoded transaction payload'),
  address: ethAddress.describe('Signing account address'),
  path: z.string().min(1).describe('HD derivation path'),
  pub: z.string().min(1).describe('Account public key'),
});

export const signOutputSchema = z.object({
  signature: z.string().describe('Signed transaction raw payload or signature'),
  txid: z.string().optional().describe('Transaction id when returned by core'),
});

export type ISignInput = z.infer<typeof signInputSchema>;
