/**
 * Integration tests — hit real onekeytest.com V2 market search API.
 * Run: RUN_INTEGRATION=1 npx jest token-resolver.integration --no-coverage
 * Skipped by default in CI / regular test runs.
 */
import { resolveToken } from '../core/token-resolver';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('token-resolver (integration — real API)', () => {
  it('resolves USDC contract address → real metadata', async () => {
    const result = await resolveToken(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'eth',
    );
    expect(result.isNative).toBe(false);
    expect(result.symbol).toMatch(/USDC/i);
    expect(result.decimals).toBe(6);
    expect(result.networkId).toBe('evm--1');
  }, 30_000);

  it('resolves USDT symbol → real search result', async () => {
    const result = await resolveToken('USDT', 'eth');
    expect(result.isNative).toBe(false);
    expect(result.symbol).toMatch(/USDT/i);
    expect(result.decimals).toBe(6);
    expect(result.contractAddress).toBeTruthy();
  }, 30_000);

  it('resolves native ETH without API call', async () => {
    const result = await resolveToken('ETH', 'eth');
    expect(result.isNative).toBe(true);
    expect(result.decimals).toBe(18);
    expect(result.symbol).toBe('ETH');
  });
});
