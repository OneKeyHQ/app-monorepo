import { z } from 'zod';

export const importInputSchema = z.object({});

export const importOutputSchema = z.object({
  address: z.string().describe('Derived wallet address'),
});
