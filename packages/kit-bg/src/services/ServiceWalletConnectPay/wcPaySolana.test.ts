import {
  WALLET_CONNECT_PAY_SOLANA_CHAINS,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';

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
