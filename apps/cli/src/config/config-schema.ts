import { z } from 'zod';

export const configSchema = z.object({
  default_chain: z.string().default('ethereum'),
  rpc_endpoint: z.string().optional(),
  output_format: z.enum(['auto', 'json', 'human']).default('auto'),
  cache_ttl: z.number().int().positive().default(1_800_000),
});

export type AppConfig = z.infer<typeof configSchema>;
