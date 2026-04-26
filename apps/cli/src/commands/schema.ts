import { zodToJsonSchema } from 'zod-to-json-schema';

import { AppError, ERROR_CODES } from '../errors';
import { OutputFormatter } from '../output';
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

function writeSchemaOutput(
  output: OutputFormatter,
  value: Record<string, unknown> | string[] | IFormattedSchema,
): void {
  output.raw(JSON.stringify(value, null, 2));
}

export function registerSchemaCommand(program: Command): void {
  program
    .command('schema [command-name]')
    .description('Output JSON Schema for CLI commands (for AI agents)')
    .option('--all', 'Output schemas for all commands')
    .option('--list', 'List available command names')
    .action(
      (
        commandName?: string,
        options?: { all?: boolean; list?: boolean },
        command?: Command,
      ) => {
        const globalOpts = command?.optsWithGlobals?.() ?? {};
        const output =
          (globalOpts._outputFormatter as OutputFormatter | undefined) ??
          new OutputFormatter('human');

        if (options?.list) {
          writeSchemaOutput(output, listCommandNames());
          return;
        }

        if (options?.all) {
          writeSchemaOutput(output, getAllSchemas());
          return;
        }

        if (!commandName) {
          const appError = new AppError(
            ERROR_CODES.PARAM_MISSING_REQUIRED.code,
            'Schema target command is required',
            'Use "onekey schema <command-name>", "onekey schema --list", or "onekey schema --all".',
          );
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
          return;
        }

        const schema = formatSchemaEntry(commandName);
        if (!schema) {
          const appError = new AppError(
            ERROR_CODES.PARAM_INVALID_COMMAND.code,
            `Unknown command: ${commandName}`,
            `Available: ${listCommandNames().join(', ')}`,
          );
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
          return;
        }

        writeSchemaOutput(output, schema);
      },
    );
}
