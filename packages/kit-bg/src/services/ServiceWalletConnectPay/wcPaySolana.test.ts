import bs58 from 'bs58';

import {
  WALLET_CONNECT_PAY_SOLANA_CHAINS,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';

import {
  extractWcPaySolanaTransaction,
  wcPaySolanaTxToEncodedTx,
} from './solPayUtils';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/wcPaySolana.test.ts
describe('wcPayChainIdToNetworkId solana', () => {
  it('maps solana mainnet to sol--101', () => {
    expect(
      wcPayChainIdToNetworkId('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'),
    ).toBe('sol--101');
  });

  it('rejects non-whitelisted solana references', () => {
    // devnet — never accepted for payments
    expect(
      wcPayChainIdToNetworkId('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
    ).toBeNull();
    // legacy deprecated mainnet id — Pay uses the CAIP-30 form only
    expect(
      wcPayChainIdToNetworkId('solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ'),
    ).toBeNull();
    // prototype-chain keys must not leak through the whitelist lookup
    expect(wcPayChainIdToNetworkId('solana:__proto__')).toBeNull();
    expect(wcPayChainIdToNetworkId('solana:constructor')).toBeNull();
    expect(wcPayChainIdToNetworkId('solana:toString')).toBeNull();
  });

  it('rejects a solana chain id with no reference', () => {
    expect(wcPayChainIdToNetworkId('solana:')).toBeNull();
    expect(wcPayChainIdToNetworkId('solana')).toBeNull();
  });

  it('still maps whitelisted eip155 chains', () => {
    expect(wcPayChainIdToNetworkId('eip155:8453')).toBe('evm--8453');
    expect(wcPayChainIdToNetworkId('eip155:2')).toBeNull();
  });

  it('exports the solana chain map keyed by CAIP-2 reference', () => {
    expect(WALLET_CONNECT_PAY_SOLANA_CHAINS).toEqual({
      '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'sol--101',
    });
  });
});

describe('extractWcPaySolanaTransaction', () => {
  it('extracts from the documented [{ transaction }] shape', () => {
    expect(extractWcPaySolanaTransaction([{ transaction: 'AQID' }])).toBe(
      'AQID',
    );
  });

  it('extracts from an unwrapped { transaction } object', () => {
    expect(extractWcPaySolanaTransaction({ transaction: 'AQID' })).toBe('AQID');
  });

  it('extracts from a bare string', () => {
    expect(extractWcPaySolanaTransaction('AQID')).toBe('AQID');
  });

  it('throws on empty or malformed params', () => {
    expect(() => extractWcPaySolanaTransaction([])).toThrow();
    expect(() =>
      extractWcPaySolanaTransaction([{ transaction: '' }]),
    ).toThrow();
    expect(() => extractWcPaySolanaTransaction(null)).toThrow();
    expect(() => extractWcPaySolanaTransaction([{ tx: 'AQID' }])).toThrow();
  });

  it('falls through invalid candidates to the first valid one', () => {
    expect(extractWcPaySolanaTransaction([{ transaction: '' }, 'AQID'])).toBe(
      'AQID',
    );
  });
});

describe('wcPaySolanaTxToEncodedTx', () => {
  it('transcodes base64 to the bs58 form the sol vault expects', () => {
    const bytes = Buffer.from([1, 2, 3, 255, 0, 42]);
    expect(wcPaySolanaTxToEncodedTx(bytes.toString('base64'))).toBe(
      bs58.encode(bytes),
    );
  });

  it('throws on an empty payload', () => {
    expect(() => wcPaySolanaTxToEncodedTx('')).toThrow();
  });

  it('rejects oversized payloads before encoding', () => {
    const big = Buffer.alloc(4097, 1).toString('base64');
    expect(() => wcPaySolanaTxToEncodedTx(big)).toThrow();
    // boundary: exactly 4096 bytes is still accepted
    const max = Buffer.alloc(4096, 1).toString('base64');
    expect(() => wcPaySolanaTxToEncodedTx(max)).not.toThrow();
  });

  it('throws on garbage base64 that decodes to nothing', () => {
    expect(() => wcPaySolanaTxToEncodedTx('!!!!')).toThrow();
  });

  it('matches a known bs58 vector', () => {
    expect(
      wcPaySolanaTxToEncodedTx(
        Buffer.from([1, 2, 3, 255, 0, 42]).toString('base64'),
      ),
    ).toBe('W7N4mUM');
  });
});
