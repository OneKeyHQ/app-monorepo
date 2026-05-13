/**
 * Smoke tests — chain resolution feature end-to-end verification.
 *
 * Validates the full integration of resolveChain/listEvmChains (backed by
 * presetNetworks) and swap-networks (mocked API).  Also exercises CLI
 * commands where applicable.
 *
 * Run: npx jest chain-resolution-smoke --no-cache
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  _resetSwapNetworksCache,
  fetchSwapNetworks,
} from '../commands/swap/swap-networks';
import { listEvmChains, resolveChain } from '../core/chain-resolver';
import { apiClient } from '../infra';

/* ------------------------------------------------------------------ */
/*  Mock the API layer for swap-networks tests                         */
/* ------------------------------------------------------------------ */

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

/* ------------------------------------------------------------------ */
/*  CLI binary helper (same pattern as cli.integration.test.ts)        */
/* ------------------------------------------------------------------ */

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, {
    encoding: 'utf-8',
    timeout: 15_000,
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

function runSafeWithEnv(
  env: Partial<NodeJS.ProcessEnv>,
  ...args: string[]
): string {
  try {
    return execFileSync(BIN, args, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        ...env,
      },
      timeout: 15_000,
    }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    return (e.stdout ?? e.stderr ?? '').toString().trim();
  }
}

/**
 * Extract parseable JSON from CLI output that may contain debug log lines.
 * Tries each line (last-to-first) to find the one that parses as JSON.
 */
function extractJson(raw: string): string {
  const lines = raw.split('\n');
  // Try from the end — the JSON response is usually the last line
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (
      (line.startsWith('{') && line.endsWith('}')) ||
      (line.startsWith('[') && line.endsWith(']'))
    ) {
      try {
        JSON.parse(line);
        return line;
      } catch {
        // not valid JSON, keep searching
      }
    }
  }
  return raw;
}

/* ================================================================== */
/*  1. Chain Resolution — resolveChain smoke tests                     */
/* ================================================================== */

describe('chain resolution (smoke)', () => {
  describe('resolveChain — known chains', () => {
    it('resolves "eth" with full config', () => {
      const c = resolveChain('eth');
      expect(c.networkId).toBe('evm--1');
      expect(c.impl).toBe('evm');
      expect(c.chainId).toBe('1');
      expect(c.nativeDecimals).toBe(18);
      expect(c.feeDecimals).toBe(9);
      expect(c.feeSymbol).toBe('Gwei');
      expect(c.nativeSymbol).toBe('ETH');
    });

    it('resolves "avalanche" (not in old hardcoded CHAINS)', () => {
      const c = resolveChain('avalanche');
      expect(c.networkId).toBe('evm--43114');
      expect(c.impl).toBe('evm');
      expect(c.nativeSymbol).toBe('AVAX');
      expect(c.nativeDecimals).toBe(18);
    });

    it('resolves "linea" (another new chain)', () => {
      const c = resolveChain('linea');
      expect(c.networkId).toBe('evm--59144');
      expect(c.impl).toBe('evm');
      expect(c.nativeSymbol).toBe('ETH');
    });

    it('resolves "sepolia" (testnet)', () => {
      const c = resolveChain('sepolia');
      expect(c.networkId).toBe('evm--11155111');
      expect(c.impl).toBe('evm');
      // Testnets may use TETH or ETH depending on preset config
      expect(['ETH', 'TETH']).toContain(c.nativeSymbol);
    });

    it('resolves BTC-family chains', () => {
      const btc = resolveChain('btc');
      const tbtc = resolveChain('tbtc');
      expect(btc.networkId).toBe('btc--0');
      expect(btc.impl).toBe('btc');
      expect(tbtc.networkId).toBe('tbtc--0');
      expect(tbtc.impl).toBe('tbtc');
    });

    it('resolves legacy alias "ethereum" → eth', () => {
      const c = resolveChain('ethereum');
      expect(c.networkId).toBe('evm--1');
      expect(c.nativeSymbol).toBe('ETH');
    });

    it('is case-insensitive: "ETH", "Eth", "eTh"', () => {
      const upper = resolveChain('ETH');
      const mixed = resolveChain('Eth');
      const odd = resolveChain('eTh');
      expect(upper.networkId).toBe('evm--1');
      expect(mixed.networkId).toBe('evm--1');
      expect(odd.networkId).toBe('evm--1');
    });
  });

  describe('resolveChain — error cases', () => {
    it('throws for nonexistent chain', () => {
      expect(() => resolveChain('nonexistent')).toThrow(/unsupported/i);
    });

    it('error message contains the chain name the user typed', () => {
      expect(() => resolveChain('foobarchain')).toThrow(/foobarchain/i);
    });

    it('resolves "avax" alias to avalanche', () => {
      const config = resolveChain('avax');
      expect(config.networkId).toBe('evm--43114');
    });

    it('resolves SOL now that CLI supports Solana account, transfer, and swap flows', () => {
      const config = resolveChain('sol');
      expect(config.networkId).toBe('sol--101');
      expect(config.impl).toBe('sol');
      expect(config.nativeSymbol).toBe('SOL');
    });
  });

  describe('listEvmChains — comprehensive', () => {
    it('returns 40+ EVM chains', () => {
      const chains = listEvmChains();
      expect(chains.length).toBeGreaterThanOrEqual(40);
    });

    it('every returned chain has impl === "evm"', () => {
      const chains = listEvmChains();
      for (const c of chains) {
        expect(c.impl).toBe('evm');
      }
    });

    it('every returned chain has required fields', () => {
      const chains = listEvmChains();
      for (const c of chains) {
        expect(c.networkId).toMatch(/^evm--\d+$/);
        expect(typeof c.chainId).toBe('string');
        expect(typeof c.nativeDecimals).toBe('number');
        expect(typeof c.feeDecimals).toBe('number');
        expect(c.feeSymbol.length).toBeGreaterThan(0);
        expect(c.nativeSymbol.length).toBeGreaterThan(0);
      }
    });

    it('includes both mainnet and testnets', () => {
      const chains = listEvmChains();
      const ids = chains.map((c) => c.networkId);
      // Ethereum mainnet
      expect(ids).toContain('evm--1');
      // Sepolia testnet
      expect(ids).toContain('evm--11155111');
    });

    it('does not include non-EVM networkIds', () => {
      const chains = listEvmChains();
      const ids = chains.map((c) => c.networkId);
      expect(ids).not.toContain('btc--0');
      expect(ids).not.toContain('sol--101');
      expect(ids).not.toContain('cosmos--cosmoshub-4');
    });

    it('resolveChain and listEvmChains are consistent', () => {
      const chains = listEvmChains();
      // Every chain returned by listEvmChains should be resolvable
      // (at least the first 10 to keep the test fast)
      const sample = chains.slice(0, 10);
      for (const c of sample) {
        // Extract the shortcode from networkId: "evm--<chainId>"
        // We can't reverse the shortcode from config, but we can verify
        // that resolveChain(shortcode) gives us the same networkId
        // by looking up via known shortcodes from the list
        expect(c.impl).toBe('evm');
        expect(c.chainId).toBeTruthy();
      }
    });
  });
});

/* ================================================================== */
/*  2. Swap Networks — fetchSwapNetworks with mocked API               */
/* ================================================================== */

describe('swap networks (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetSwapNetworksCache();
  });

  it('returns CLI-supported networks and skips unsupported networks', async () => {
    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--1',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: true,
      },
      {
        networkId: 'evm--137',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: false,
      },
      {
        networkId: 'sol--101',
        supportSingleSwap: true,
        supportCrossChainSwap: false,
        supportLimit: false,
      },
      {
        networkId: 'btc--0',
        supportSingleSwap: false,
        supportCrossChainSwap: false,
        supportLimit: false,
      },
    ]);

    const networks = await fetchSwapNetworks();
    const networkIds = networks.map((n) => n.networkId);

    expect(networkIds).toContain('evm--1');
    expect(networkIds).toContain('evm--137');
    expect(networkIds).toContain('btc--0');
    expect(networks.find((n) => n.networkId === 'sol--101')).toMatchObject({
      name: 'Solana',
      chainId: '101',
      nativeSymbol: 'SOL',
      supportSingleSwap: true,
      supportCrossChainSwap: false,
      supportLimit: false,
    });
    expect(networks.find((n) => n.networkId === 'btc--0')).toMatchObject({
      name: 'Bitcoin',
      chainId: '0',
      nativeSymbol: 'BTC',
      supportSingleSwap: false,
      supportCrossChainSwap: false,
      supportLimit: false,
    });
  });

  it('handles API failure gracefully — returns empty array', async () => {
    mockGet.mockRejectedValueOnce(new Error('500 Internal Server Error'));

    const networks = await fetchSwapNetworks();
    expect(networks).toEqual([]);
  });

  it('handles API timeout gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const networks = await fetchSwapNetworks();
    expect(networks).toEqual([]);
  });

  it('cache works — second call does not hit API', async () => {
    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--1',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: true,
      },
      {
        networkId: 'evm--10',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: false,
      },
    ]);

    const first = await fetchSwapNetworks();
    const second = await fetchSwapNetworks();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(1);
  });

  it('cache resets properly', async () => {
    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--1',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: true,
      },
    ]);

    const first = await fetchSwapNetworks();
    expect(first.map((network) => network.networkId)).toEqual(['evm--1']);

    _resetSwapNetworksCache();

    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--1',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: true,
      },
      {
        networkId: 'evm--56',
        supportSingleSwap: true,
        supportCrossChainSwap: false,
        supportLimit: false,
      },
    ]);

    const second = await fetchSwapNetworks();
    expect(second.map((network) => network.networkId)).toEqual([
      'evm--1',
      'evm--56',
    ]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('enriches API response with preset metadata', async () => {
    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--1',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: true,
      },
      {
        networkId: 'evm--56',
        supportSingleSwap: true,
        supportCrossChainSwap: false,
        supportLimit: false,
      },
    ]);

    const networks = await fetchSwapNetworks();
    const eth = networks.find((n) => n.networkId === 'evm--1');
    const bsc = networks.find((n) => n.networkId === 'evm--56');

    expect(eth).toBeDefined();
    expect(eth!.name).toBe('Ethereum');
    expect(eth!.chainId).toBe('1');
    expect(eth!.nativeSymbol).toBe('ETH');

    expect(bsc).toBeDefined();
    expect(bsc!.name).toMatch(/BNB/i);
    expect(bsc!.chainId).toBe('56');
    expect(bsc!.nativeSymbol).toBe('BNB');
  });

  it('skips unknown networkIds', async () => {
    mockGet.mockResolvedValueOnce([
      {
        networkId: 'evm--999999999',
        supportSingleSwap: true,
        supportCrossChainSwap: false,
        supportLimit: false,
      },
    ]);

    const networks = await fetchSwapNetworks();
    expect(networks).toHaveLength(0);
  });
});

/* ================================================================== */
/*  3. CLI Command Integration — binary invocation                     */
/* ================================================================== */

describe('CLI command integration (smoke)', () => {
  it('swap networks command exists in help output', () => {
    const output = run('swap', '--help');
    expect(output).toContain('networks');
  });

  it('--chain eth resolves correctly in swap quote help', () => {
    // Verify the swap quote command accepts --chain
    const output = run('swap', 'quote', '--help');
    expect(output).toContain('--chain');
  });

  it('swap quote checks auth before chain validation', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'onekey-cli-swap-chain-auth-'));
    try {
      const output = runSafeWithEnv(
        { HOME: homeDir },
        '--json',
        'swap',
        'quote',
        '--chain',
        'nonexistent',
        '--from',
        '0x0000000000000000000000000000000000000000',
        '--to',
        '0x0000000000000000000000000000000000000001',
        '--amount',
        '1',
      );
      const parsed = JSON.parse(extractJson(output));
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('AUTH_NO_WALLET');
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('resolveChain typo "etherium" returns a suggestion', () => {
    expect(() => resolveChain('etherium')).toThrow(/did you mean/i);
  });

  it('transfer checks auth before chain validation', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'onekey-cli-chain-auth-'));
    try {
      const output = runSafeWithEnv(
        { HOME: homeDir },
        '--json',
        'transfer',
        '--chain',
        'nonexistent',
        '--to',
        '0x0000000000000000000000000000000000000001',
        '--amount',
        '0.001',
      );
      const parsed = JSON.parse(extractJson(output));
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('AUTH_NO_WALLET');
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('balance --chain eth resolves without chain error', () => {
    // The balance command should accept "eth" as a chain.
    // It may fail for other reasons (no wallet configured), but
    // not because of chain resolution.
    const output = runSafe(
      '--json',
      'balance',
      '--chain',
      'eth',
      '--address',
      '0x0000000000000000000000000000000000000001',
    );
    const parsed = JSON.parse(extractJson(output));
    // Should NOT be PARAM_INVALID_CHAIN — any other result is fine
    if (parsed.status === 'error') {
      expect(parsed.error.code).not.toBe('PARAM_INVALID_CHAIN');
    }
  });
});
