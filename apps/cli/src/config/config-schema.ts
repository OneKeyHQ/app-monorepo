import { z } from 'zod';

export const configSchema = z.object({
  default_chain: z.string().default('ethereum'),
  rpc_endpoint: z.string().optional(),
  output_format: z.enum(['auto', 'json', 'human']).default('auto'),
  cache_ttl: z.number().int().positive().default(1_800_000),
  default_slippage: z.number().min(0.05).max(50).default(0.5),
  auto_security_check: z.boolean().default(true),
});

export type IAppConfig = z.infer<typeof configSchema>;
