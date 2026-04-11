import { z } from 'zod';

export const logoutInputSchema = z.object({});

export const logoutOutputSchema = z.object({
  status: z.literal('logged_out'),
});
