import { zodToJsonSchema } from 'zod-to-json-schema';

import { getSchemaRegistry } from '../schemas/registry';

import type { Command } from 'commander';

interface IFormattedSchema {
  name: string;
  description: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  examples?: string[];
}

export function listCommandNames(): string[] {
  return [...getSchemaRegistry().keys()];
}

export function formatSchemaEntry(name: string): IFormattedSchema | null {
  const entry = getSchemaRegistry().get(name);
  if (!entry) return null;
  return {
    name,
    description: entry.description,
    input: zodToJsonSchema(entry.input, { target: 'openApi3' }) as Record<
      string,
      unknown
    >,
    output: zodToJsonSchema(entry.output, { target: 'openApi3' }) as Record<
      string,
      unknown
    >,
    examples: entry.examples,
  };
}

export function getAllSchemas(): Record<string, IFormattedSchema> {
  const result: Record<string, IFormattedSchema> = {};
  for (const name of listCommandNames()) {
    const entry = formatSchemaEntry(name);
    if (entry) {
      result[name] = entry;
    }
  }
  return result;
}

export function registerSchemaCommand(program: Command): void {
  program
    .command('schema [command-name]')
    .description('Output JSON Schema for CLI commands (for AI agents)')
    .option('--all', 'Output schemas for all commands')
    .option('--list', 'List available command names')
    .action(
      (commandName?: string, options?: { all?: boolean; list?: boolean }) => {
        if (options?.list) {
          console.log(JSON.stringify(listCommandNames(), null, 2));
          return;
        }

        if (options?.all) {
          console.log(JSON.stringify(getAllSchemas(), null, 2));
          return;
        }

        if (!commandName) {
          console.error('Usage: onekey schema <command-name> | --all | --list');
          process.exit(1);
        }

        const schema = formatSchemaEntry(commandName);
        if (!schema) {
          console.error(`Unknown command: ${commandName}`);
          console.error(`Available: ${listCommandNames().join(', ')}`);
          process.exit(1);
        }

        console.log(JSON.stringify(schema, null, 2));
      },
    );
}
