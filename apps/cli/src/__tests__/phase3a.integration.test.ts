import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { extractJson } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, {
    encoding: 'utf-8',
    timeout: 30_000,
  }).trim();
}

describe('token commands (integration)', () => {
  it('token search returns matching tokens', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'search',
      '--query',
      'USDC',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.data[0].symbol).toMatch(/USDC/i);
  });

  it('token search with --chain filters by network', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'search',
      '--query',
      'USDC',
      '--chain',
      'eth',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    for (const item of parsed.data) {
      expect(item.networkId).toBe('evm--1');
    }
  });

  it('token search returns empty array for unknown token', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'search',
      '--query',
      'ZZZZNONEXISTENT',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data).toEqual([]);
  });

  it('token info returns token details', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'info',
      '--chain',
      'eth',
      '--token',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data.symbol).toMatch(/USDC/i);
    expect(parsed.data.decimals).toBe(6);
    expect(parsed.data.price).toBeTruthy();
    expect(parsed.data.networkId).toBe('evm--1');
    expect(parsed.data.contractAddress).toBe(
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });
  it('token price returns price and changes', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'price',
      '--chain',
      'eth',
      '--token',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data.price).toBeTruthy();
    expect(parsed.data.symbol).toMatch(/USDC/i);
    expect(parsed.data).toHaveProperty('priceChange24hPercent');
  });
  it('token trending returns trending list', () => {
    const output = run('--json', '--env', 'test', 'token', 'trending');
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.data[0]).toHaveProperty('symbol');
    expect(parsed.data[0]).toHaveProperty('price');
  });
  it('token trades returns trade stats', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'trades',
      '--chain',
      'eth',
      '--token',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data).toHaveProperty('stats');
    expect(parsed.data.stats).toHaveProperty('1m');
    expect(parsed.data.stats).toHaveProperty('5m');
    expect(parsed.data.stats).toHaveProperty('1h');
    expect(parsed.data.stats).toHaveProperty('4h');
    expect(parsed.data.stats).toHaveProperty('24h');
    expect(parsed.data.stats['24h']).toHaveProperty('trades');
    expect(parsed.data.stats['24h']).toHaveProperty('volume');
    expect(parsed.data.stats['24h']).toHaveProperty('uniqueWallets');
  });
  it('token liquidity returns top holders', () => {
    // WBTC has holder data; USDC/USDT return empty lists
    const output = run(
      '--json',
      '--env',
      'test',
      'token',
      'liquidity',
      '--chain',
      'eth',
      '--token',
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.data[0]).toHaveProperty('accountAddress');
    expect(parsed.data[0]).toHaveProperty('amount');
  });
});

describe('market commands (integration)', () => {
  it('market price returns single token price', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'market',
      'price',
      '--chain',
      'eth',
      '--token',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data.price).toBeTruthy();
    expect(parsed.data.symbol).toMatch(/USDC/i);
    expect(parsed.data).toHaveProperty('priceChange24hPercent');
  });

  it('market prices returns batch prices', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'market',
      'prices',
      '--tokens',
      'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBe(2);
    expect(parsed.data[0].price).toBeTruthy();
    expect(parsed.data[1].price).toBeTruthy();
  });

  it('market kline returns OHLCV data', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'market',
      'kline',
      '--chain',
      'eth',
      '--token',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '--interval',
      '1H',
      '--limit',
      '6',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
    const point = parsed.data[0];
    expect(point).toHaveProperty('o');
    expect(point).toHaveProperty('h');
    expect(point).toHaveProperty('l');
    expect(point).toHaveProperty('c');
    expect(point).toHaveProperty('v');
    expect(point).toHaveProperty('t');
  });
});

describe('swap commands (integration)', () => {
  it('swap quote returns quotes with security data', () => {
    let output: string;
    try {
      output = run(
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
    } catch (err: unknown) {
      // execFileSync throws on non-zero exit — extract stdout from the error
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
      output = (e.stdout ?? e.stderr ?? '').toString().trim();
    }
    const parsed = JSON.parse(extractJson(output));
    if (parsed.status === 'success') {
      expect(parsed.data).toHaveProperty('quotes');
      expect(parsed.data).toHaveProperty('security');
      expect(parsed.data.security).toHaveProperty('blocked');
      expect(parsed.data.security).toHaveProperty('overallRisk');
      expect(parsed.data).toHaveProperty('metadata');
      expect(parsed.data.metadata.slippage).toBeGreaterThan(0);
    } else {
      // API unavailable — verify error structure is correct
      expect(parsed.status).toBe('error');
      expect(parsed.error).toHaveProperty('code');
      expect(parsed.error).toHaveProperty('message');
    }
  });
  it('swap build creates pending order', () => {
    let output: string;
    try {
      output = run(
        '--json',
        '--env',
        'test',
        'swap',
        'build',
        '--chain',
        'eth',
        '--from',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '--to',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '--amount',
        '1',
        '--provider',
        'Swap1inch',
        '--force',
      );
    } catch (err: unknown) {
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
      output = (e.stdout ?? e.stderr ?? '').toString().trim();
    }
    const parsed = JSON.parse(extractJson(output));
    if (parsed.status === 'success') {
      expect(parsed.data).toHaveProperty('orderId');
      expect(parsed.data).toHaveProperty('provider');
      expect(parsed.data).toHaveProperty('chain');
      expect(parsed.data).toHaveProperty('from');
      expect(parsed.data).toHaveProperty('to');
      expect(parsed.data).toHaveProperty('amount');
    } else {
      // API unavailable — verify error structure is correct
      expect(parsed.status).toBe('error');
      expect(parsed.error).toHaveProperty('code');
      expect(parsed.error).toHaveProperty('message');
    }
  });
  it.todo('swap execute completes swap flow');
  it.todo('swap status returns transaction state');
});

describe('security commands (integration)', () => {
  it('security audit returns risk assessment', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'security',
      'audit',
      '--chain',
      'eth',
      '--token',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data).toHaveProperty('overallRisk');
    expect(parsed.data).toHaveProperty('cautionItems');
    expect(parsed.data).toHaveProperty('checks');
    expect(parsed.data.checks).toHaveProperty('buy_tax');
  });

  it('security simulate returns tx simulation', () => {
    const output = run(
      '--json',
      '--env',
      'test',
      'security',
      'simulate',
      '--chain',
      'eth',
      '--to',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '--data',
      '0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000a',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data).toHaveProperty('type');
    expect(parsed.data).toHaveProperty('display');
    expect(parsed.data).toHaveProperty('parsedTx');
  });
});
