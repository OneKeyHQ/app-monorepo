import { z } from 'zod';

import {
  formatSchemaEntry,
  getAllSchemas,
  listCommandNames,
} from '../commands/schema';
import { defineCommand, resetRegistry } from '../schemas/registry';

describe('onekey schema command', () => {
  beforeEach(() => {
    resetRegistry();
    defineCommand({
      name: 'test-cmd',
      description: 'Test command',
      input: z.object({
        chain: z.string().describe('Target chain'),
        amount: z.string().regex(/^\d+$/).describe('Amount'),
      }),
      output: z.object({
        txid: z.string(),
      }),
      examples: ['onekey test-cmd --chain eth --amount 1'],
    });
    defineCommand({
      name: 'test-other',
      description: 'Another command',
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
    });
  });

  it('lists all command names', () => {
    expect(listCommandNames()).toEqual(['test-cmd', 'test-other']);
  });

  it('formats a single command schema as JSON Schema', () => {
    const result = formatSchemaEntry('test-cmd');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('test-cmd');
    expect(result!.description).toBe('Test command');
    expect(result!.input.type).toBe('object');
    expect(result!.input.properties.chain).toBeDefined();
    expect(result!.input.properties.amount).toBeDefined();
    expect(result!.output.type).toBe('object');
    expect(result!.output.properties.txid).toBeDefined();
    expect(result!.examples).toEqual([
      'onekey test-cmd --chain eth --amount 1',
    ]);
  });

  it('returns null for unknown command', () => {
    expect(formatSchemaEntry('nonexistent')).toBeNull();
  });

  it('exports all schemas', () => {
    const all = getAllSchemas();
    expect(Object.keys(all)).toEqual(['test-cmd', 'test-other']);
    expect(all['test-cmd'].description).toBe('Test command');
    expect(all['test-other'].description).toBe('Another command');
  });
});
