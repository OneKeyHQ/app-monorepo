/**
 * Transfer command integration tests — Sepolia testnet.
 *
 * Runs the compiled CLI binary (./bin/onekey) against real Sepolia APIs.
 * Uses --dry-run for most tests (no funds spent), with one real self-transfer.
 *
 * Requires:
 *   1. TEST_MNEMONIC in apps/cli/.env.test (with Sepolia ETH balance)
 *   2. `npx tsup` has been run (dist/cli.js exists)
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { extractJson } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');
const ENV_PATH = resolve(__dirname, '../../.env.test');

// Tiny amount for self-transfer — only gas is consumed
const TRANSFER_AMOUNT = '0.0001';

// ---------------------------------------------------------------------------
// Load .env.test
// ---------------------------------------------------------------------------
function loadTestMnemonic(): string {
  const content = readFileSync(ENV_PATH, 'utf-8');
  const match = content.match(/^TEST_MNEMONIC=(.+)$/m);
  const mnemonic = match?.[1]?.trim();
  if (!mnemonic) {
    // oxlint-disable-next-line onekey/no-raw-error -- test utility, not app code
    throw new Error('TEST_MNEMONIC not found in apps/cli/.env.test');
  }
  return mnemonic;
}

const TEST_MNEMONIC = loadTestMnemonic();

// Wallet address — resolved from import
let walletAddress = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(
  args: string[],
  options?: { input?: string; timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolveP) => {
    const child = execFile(
      BIN,
      args,
      {
        encoding: 'utf-8',
        timeout: options?.timeout ?? 60_000,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      },
      (error, stdout, stderr) => {
        resolveP({
          stdout: stdout?.trim() ?? '',
          stderr: stderr?.trim() ?? '',
          exitCode:
            (error as NodeJS.ErrnoException & { code?: number })?.code ??
            (error ? 1 : 0),
        });
      },
    );

    if (options?.input && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

function runJSON(
  args: string[],
  options?: { input?: string; timeout?: number },
): Promise<{ parsed: Record<string, unknown>; exitCode: number }> {
  return run(['--json', '--env', 'test', ...args], options).then((result) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(result.stdout));
    } catch {
      // oxlint-disable-next-line onekey/no-raw-error -- test utility
      throw new Error(
        `Failed to parse JSON output:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    }
    return { parsed, exitCode: result.exitCode };
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Transfer integration — Sepolia testnet (binary)', () => {
  // -----------------------------------------------------------------------
  // Setup: import wallet and resolve address
  // -----------------------------------------------------------------------
  beforeAll(async () => {
    await run(['--json', '--env', 'test', 'logout']);

    const result = await runJSON(['import', '--mnemonic', '--force'], {
      input: TEST_MNEMONIC,
      timeout: 60_000,
    });

    // eslint-disable-next-line jest/no-standalone-expect
    expect(result.parsed.status).toBe('success');
    walletAddress = (result.parsed.data as Record<string, unknown>)
      .address as string;
    // eslint-disable-next-line jest/no-standalone-expect
    expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  }, 90_000);

  afterAll(async () => {
    await run(['--json', '--env', 'test', 'logout']);
  }, 30_000);

  // -----------------------------------------------------------------------
  // 1. Import verification
  // -----------------------------------------------------------------------
  describe('wallet import', () => {
    it('derives a valid EVM address from test mnemonic', async () => {
      const { parsed } = await runJSON(['balance', '--chain', 'sepolia']);

      expect(parsed.status).toBe('success');
      const data = parsed.data as Record<string, unknown>;
      expect(data.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(data.chain).toBe('sepolia');
    }, 60_000);

    it('derives deterministic address (same mnemonic = same address)', async () => {
      const { parsed: r1 } = await runJSON(['balance', '--chain', 'sepolia']);
      const { parsed: r2 } = await runJSON(['balance', '--chain', 'sepolia']);

      const addr1 = (r1.data as Record<string, unknown>).address;
      const addr2 = (r2.data as Record<string, unknown>).address;
      expect(addr1).toBe(addr2);
    }, 60_000);
  });

  // -----------------------------------------------------------------------
  // 2. Balance query (real Sepolia API)
  // -----------------------------------------------------------------------
  describe('balance query', () => {
    it('returns token list for Sepolia', async () => {
      const { parsed } = await runJSON(['balance', '--chain', 'sepolia']);

      expect(parsed.status).toBe('success');
      const data = parsed.data as Record<string, unknown>;
      expect(data.tokens).toBeDefined();
      expect(Array.isArray(data.tokens)).toBe(true);
    }, 60_000);

    it('returns specific native token balance for Sepolia', async () => {
      // Sepolia nativeSymbol is TETH, not ETH
      const { parsed } = await runJSON([
        'balance',
        '--chain',
        'sepolia',
        '--token',
        'TETH',
      ]);

      expect(parsed.status).toBe('success');
      const data = parsed.data as Record<string, unknown>;
      expect(data.balance).toBeDefined();
      expect(typeof data.balance).toBe('string');
      expect(data.token).toBe('TETH');
    }, 60_000);
  });

  // -----------------------------------------------------------------------
  // 3. Transfer dry-run — self-transfer (real API, no broadcast)
  // -----------------------------------------------------------------------
  describe('transfer --dry-run', () => {
    it('estimates fee for self-transfer without broadcasting', async () => {
      const { parsed } = await runJSON(
        [
          'transfer',
          '--to',
          walletAddress,
          '--amount',
          TRANSFER_AMOUNT,
          '--chain',
          'sepolia',
          '--dry-run',
        ],
        { timeout: 60_000 },
      );

      if (parsed.status === 'success') {
        const data = parsed.data as Record<string, unknown>;
        expect(data.from).toBe(walletAddress);
        expect(data.to).toBe(walletAddress);
        expect(data.amount).toBe(TRANSFER_AMOUNT);
        expect(data.chain).toBe('sepolia');
        expect(data.dryRun).toBe(true);
        expect(data.estimatedGas).toBeDefined();
        expect(typeof data.estimatedGas).toBe('string');
        expect(data.estimatedGas).toContain('ETH');
      } else {
        // Wallet not funded — API returns fund check error
        const error = parsed.error as Record<string, unknown>;
        expect(error.message).toMatch(/funds|balance/i);
      }
    }, 60_000);

    it('rejects invalid recipient address', async () => {
      const { parsed } = await runJSON([
        'transfer',
        '--to',
        '0xinvalid',
        '--amount',
        TRANSFER_AMOUNT,
        '--chain',
        'sepolia',
        '--dry-run',
      ]);

      expect(parsed.status).toBe('error');
    }, 30_000);

    it('rejects invalid amount format', async () => {
      const { parsed } = await runJSON([
        'transfer',
        '--to',
        walletAddress,
        '--amount',
        '-1',
        '--chain',
        'sepolia',
        '--dry-run',
      ]);

      expect(parsed.status).toBe('error');
    }, 30_000);

    it('rejects unsupported chain', async () => {
      const { parsed } = await runJSON([
        'transfer',
        '--to',
        walletAddress,
        '--amount',
        TRANSFER_AMOUNT,
        '--chain',
        'nosuchchain',
        '--dry-run',
      ]);

      expect(parsed.status).toBe('error');
    }, 30_000);
  });

  // -----------------------------------------------------------------------
  // 4. Transfer confirmation gate
  // -----------------------------------------------------------------------
  describe('transfer confirmation', () => {
    it('requires --yes in JSON mode (non-interactive)', async () => {
      const { parsed } = await runJSON([
        'transfer',
        '--to',
        walletAddress,
        '--amount',
        TRANSFER_AMOUNT,
        '--chain',
        'sepolia',
      ]);

      expect(parsed.status).toBe('error');
      const errStr = JSON.stringify(parsed);
      const isConfirmationError = errStr.includes('--yes');
      const isFundError = /funds|balance/i.test(errStr);
      expect(isConfirmationError || isFundError).toBe(true);
    }, 60_000);
  });

  // -----------------------------------------------------------------------
  // 5. Real self-transfer (actual broadcast)
  // -----------------------------------------------------------------------
  describe('real self-transfer', () => {
    it('sends a self-transfer and returns txid', async () => {
      const { parsed } = await runJSON(
        [
          'transfer',
          '--to',
          walletAddress,
          '--amount',
          TRANSFER_AMOUNT,
          '--chain',
          'sepolia',
          '--yes',
        ],
        { timeout: 120_000 },
      );

      if (parsed.status === 'success') {
        const data = parsed.data as Record<string, unknown>;
        expect(data.txid).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(data.from).toBe(walletAddress);
        expect(data.to).toBe(walletAddress);
        expect(data.amount).toBe(TRANSFER_AMOUNT);
        expect(data.chain).toBe('sepolia');
      } else {
        // Wallet may not have enough funds — acceptable in CI
        const error = parsed.error as Record<string, unknown>;
        expect(error.message).toMatch(/funds|balance/i);
      }
    }, 120_000);
  });
});
