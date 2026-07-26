import { parseLedgerLiveAccountNames } from './ledgerLiveAccountNames';

describe('parseLedgerLiveAccountNames', () => {
  it('prefers accountsData names and joins account details by id', () => {
    expect(
      parseLedgerLiveAccountNames({
        data: {
          wallet: {
            accountsData: {
              accountNames: [['ethereum_1', 'Main Ledger']],
            },
          },
          accounts: [
            {
              id: 'ethereum_1',
              data: {
                freshAddress: `0x${'ab'.repeat(20)}`,
              },
              currency: { id: 'ethereum' },
            },
          ],
        },
      }),
    ).toEqual({
      status: 'available',
      accounts: [
        {
          name: 'Main Ledger',
          address: `0x${'ab'.repeat(20)}`,
        },
      ],
    });
  });

  it('falls back to the legacy Ethereum account data name', () => {
    expect(
      parseLedgerLiveAccountNames({
        data: {
          accounts: [
            {
              id: 'ethereum_2',
              data: {
                name: 'Cold ETH',
                freshAddress: `0x${'de'.repeat(20)}`,
              },
              currency: { id: 'ethereum' },
            },
          ],
        },
      }),
    ).toEqual({
      status: 'available',
      accounts: [{ name: 'Cold ETH', address: `0x${'de'.repeat(20)}` }],
    });
  });

  it('does not expose xpubs or suggest names from another currency', () => {
    expect(
      parseLedgerLiveAccountNames({
        data: {
          accounts: [
            {
              id: 'bitcoin_1',
              data: {
                name: 'Cold BTC',
                freshAddress: 'bc1qexample',
                xpub: 'xpub-sensitive',
              },
              currency: { id: 'bitcoin' },
            },
          ],
        },
      }),
    ).toEqual({
      status: 'no_accounts',
      accounts: [],
    });
  });

  it('rejects oversized names and malformed EVM addresses before IPC', () => {
    expect(
      parseLedgerLiveAccountNames({
        data: {
          accounts: [
            {
              id: 'ethereum_long_name',
              name: 'n'.repeat(81),
              address: `0x${'ab'.repeat(20)}`,
              currency: { id: 'ethereum' },
            },
            {
              id: 'ethereum_bad_address',
              name: 'Looks valid',
              address: '0x1234',
              currency: { id: 'ethereum' },
            },
          ],
        },
      }),
    ).toEqual({
      status: 'no_accounts',
      accounts: [],
    });
  });

  it('does not attempt to parse password-encrypted account data', () => {
    expect(
      parseLedgerLiveAccountNames({
        data: { wallet: { accountsData: 'encrypted-aes-payload' } },
      }),
    ).toEqual({ status: 'encrypted_source', accounts: [] });
  });
});
