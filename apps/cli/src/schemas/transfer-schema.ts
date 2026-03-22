import { z } from 'zod';

const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const transferOptionsSchema = z.object({
  to: ethAddress,
  amount: z.string().regex(/^\d+\.?\d*$/, 'Amount must be a positive number'),
  token: ethAddress.optional(),
  chain: z.string().optional(),
  dryRun: z.boolean().optional(),
  yes: z.boolean().optional(),
});

export type ITransferOptions = z.infer<typeof transferOptionsSchema>;
