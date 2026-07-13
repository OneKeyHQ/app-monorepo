import { z } from 'zod';

export const getAddressInputSchema = z.object({
  format: z.enum(['json', 'text']).optional(),
});

export const getAddressOutputSchema = z.object({
  address: z.string(),
});
