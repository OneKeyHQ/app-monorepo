import { z } from 'zod';

import { btcAddressType, chainId } from './common';

const walletAddressTypeInfoSchema = z.object({
  chain: z.string(),
  networkId: z.string(),
  addressType: btcAddressType,
  label: z.string(),
  deriveType: z.string(),
  addressEncoding: z.union([z.string(), z.number()]),
  path: z.string(),
  accountPath: z.string(),
  relPath: z.string(),
});

export const walletAddressTypesInputSchema = z.object({
  chain: chainId.describe('Bitcoin chain alias: btc or tbtc'),
});

export const walletAddressTypesOutputSchema = z.array(
  walletAddressTypeInfoSchema,
);

export const walletAddressInputSchema = z.object({
  chain: chainId.describe('Bitcoin chain alias: btc or tbtc'),
  addressType: btcAddressType.describe('BTC address type to derive'),
});

export const walletAddressOutputSchema = walletAddressTypeInfoSchema.extend({
  address: z.string(),
  publicKey: z.string().optional(),
});
