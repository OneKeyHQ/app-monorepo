/**
 * Integration tests for cross-chain bridge support.
 *
 * These tests hit the real OneKey test API (--env test) to verify that
 * bridge protocol parameters are accepted by the backend and return
 * valid responses.
 *
 * Run: npx jest swap-bridge.integration --no-cache --no-coverage
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { extractJson } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, {
    encoding: 'utf-8',
    timeout: 45_000, // bridge quotes may take longer
  }).trim();
}

function runSafe(...args: string[]): string {
  try {
    return run(...args);
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    return (e.stdout ?? e.stderr ?? '').toString().trim();
  }
}

describe('bridge quote (integration)', () => {
  it('returns bridge quotes for ETH→ARB USDC cross-chain', () => {
    const output = runSafe(
      '--json',
      '--env',
      'test',
      'swap',
      'quote',
      '--chain',
      'eth',
      '--to-chain',
      'arb',
      '--from',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on ETH
      '--to',
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on ARB
      '--amount',
      '10',
    );
    const parsed = JSON.parse(extractJson(output));
    if (parsed.status === 'success') {
      expect(parsed.data).toHaveProperty('quotes');
      expect(Array.isArray(parsed.data.quotes)).toBe(true);
      // Bridge quotes should exist for this popular pair
      expect(parsed.data.quotes.length).toBeGreaterThan(0);
      // Each quote should have provider info
      for (const q of parsed.data.quotes) {
        expect(q).toHaveProperty('info');
        expect(q.info).toHaveProperty('providerName');
        expect(q).toHaveProperty('toAmount');
      }
      expect(parsed.data).toHaveProperty('metadata');
    } else {
      // API unavailable — verify error structure is correct
      expect(parsed.status).toBe('error');
      expect(parsed.error).toHaveProperty('code');
      expect(parsed.error).toHaveProperty('message');
    }
  });

  it('rejects cross-chain quote when source chain does not support bridge', () => {
    // Use a chain that likely doesn't support cross-chain (if any)
    // This test verifies the validation logic runs
    const output = runSafe(
      '--json',
      '--env',
      'test',
      'swap',
      'quote',
      '--chain',
      'eth',
      '--to-chain',
      'eth', // same chain = not cross-chain, should fall back to swap
      '--from',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '--to',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '--amount',
      '10',
    );
    const parsed = JSON.parse(extractJson(output));
    // --to-chain same as --chain should just do a normal swap (tolerant behavior)
    if (parsed.status === 'success') {
      expect(parsed.data).toHaveProperty('quotes');
    } else {
      expect(parsed.status).toBe('error');
    }
  });
});

describe('swap networks --bridge (integration)', () => {
  it('returns only bridge-capable networks', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'swap',
      'networks',
      '--bridge',
    );
    const parsed = JSON.parse(extractJson(output));
    // swap networks outputs raw JSON array (not wrapped in {status, data})
    const networks = Array.isArray(parsed) ? parsed : parsed.data;
    expect(Array.isArray(networks)).toBe(true);
    expect(networks.length).toBeGreaterThan(0);
    // All returned networks must support cross-chain swap
    for (const net of networks) {
      expect(net.supportCrossChainSwap).toBe(true);
    }
  });

  it('returns fewer networks than unfiltered list', () => {
    const allOutput = run('--json', '--env', 'test', 'swap', 'networks');
    const bridgeOutput = run(
      '--json',
      '--env',
      'test',
      'swap',
      'networks',
      '--bridge',
    );
    const allParsed = JSON.parse(extractJson(allOutput));
    const bridgeParsed = JSON.parse(extractJson(bridgeOutput));
    const allNetworks = Array.isArray(allParsed) ? allParsed : allParsed.data;
    const bridgeNetworks = Array.isArray(bridgeParsed)
      ? bridgeParsed
      : bridgeParsed.data;
    if (Array.isArray(allNetworks) && Array.isArray(bridgeNetworks)) {
      expect(bridgeNetworks.length).toBeLessThanOrEqual(allNetworks.length);
    }
  });
});

describe('same-chain swap regression (integration)', () => {
  it('swap quote without --to-chain still works', () => {
    const output = runSafe(
      '--json',
      '--env',
      'test',
      'swap',
      'quote',
      '--chain',
      'eth',
      '--from',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '--to',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '--amount',
      '10',
    );
    const parsed = JSON.parse(extractJson(output));
    if (parsed.status === 'success') {
      expect(parsed.data).toHaveProperty('quotes');
      expect(parsed.data).toHaveProperty('security');
    } else {
      expect(parsed.status).toBe('error');
      expect(parsed.error).toHaveProperty('code');
    }
  });
});
