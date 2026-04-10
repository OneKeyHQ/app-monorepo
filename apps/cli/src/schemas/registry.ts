import { AppError } from '../errors';

import type { z } from 'zod';

export interface ICommandSchema {
  input: z.ZodType;
  output: z.ZodType;
  description: string;
  examples?: string[];
}

const schemaRegistry = new Map<string, ICommandSchema>();

export function defineCommand<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(def: {
  name: string;
  description: string;
  input: TInput;
  output: TOutput;
  examples?: string[];
}): {
  name: string;
  description: string;
  input: TInput;
  output: TOutput;
  examples?: string[];
} {
  if (schemaRegistry.has(def.name)) {
    throw new AppError(
      'SCHEMA_DUPLICATE',
      `Command "${def.name}" is already registered in schema registry`,
      `Check register-all.ts for duplicate defineCommand("${def.name}") calls`,
    );
  }
  schemaRegistry.set(def.name, {
    input: def.input,
    output: def.output,
    description: def.description,
    examples: def.examples,
  });
  return def;
}

export function getSchemaRegistry(): ReadonlyMap<string, ICommandSchema> {
  return schemaRegistry;
}

/** For testing only */
export function resetRegistry(): void {
  schemaRegistry.clear();
}
