import { z } from 'zod';

import {
  defineCommand,
  getSchemaRegistry,
  resetRegistry,
} from '../schemas/registry';

describe('Schema Registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('registers a command and retrieves it', () => {
    const input = z.object({ chain: z.string() });
    const output = z.object({ price: z.string() });

    defineCommand({
      name: 'test-cmd',
      description: 'A test command',
      input,
      output,
    });

    const registry = getSchemaRegistry();
    expect(registry.has('test-cmd')).toBe(true);
    const entry = registry.get('test-cmd')!;
    expect(entry.description).toBe('A test command');
    expect(entry.input).toBe(input);
    expect(entry.output).toBe(output);
  });

  it('lists all registered commands', () => {
    defineCommand({
      name: 'cmd-a',
      description: 'A',
      input: z.object({}),
      output: z.object({}),
    });
    defineCommand({
      name: 'cmd-b',
      description: 'B',
      input: z.object({}),
      output: z.object({}),
    });

    const registry = getSchemaRegistry();
    expect([...registry.keys()]).toEqual(['cmd-a', 'cmd-b']);
  });

  it('stores examples when provided', () => {
    defineCommand({
      name: 'with-examples',
      description: 'Has examples',
      input: z.object({}),
      output: z.object({}),
      examples: ['onekey test --flag'],
    });

    const entry = getSchemaRegistry().get('with-examples')!;
    expect(entry.examples).toEqual(['onekey test --flag']);
  });

  it('throws on duplicate command name', () => {
    defineCommand({
      name: 'dup',
      description: 'First',
      input: z.object({}),
      output: z.object({}),
    });

    expect(() =>
      defineCommand({
        name: 'dup',
        description: 'Second',
        input: z.object({}),
        output: z.object({}),
      }),
    ).toThrow('already registered');
  });
});
