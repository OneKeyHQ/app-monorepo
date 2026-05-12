import { z } from 'zod';

export const versionInputSchema = z.object({});

export const versionOutputSchema = z.object({
  version: z.string(),
  env: z.string(),
});
