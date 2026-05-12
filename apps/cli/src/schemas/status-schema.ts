import { z } from 'zod';

export const statusInputSchema = z.object({});

export const statusOutputSchema = z.object({
  status: z.literal('connected'),
  env: z.string(),
  latency_ms: z.number().optional(),
  note: z.string().optional(),
});
