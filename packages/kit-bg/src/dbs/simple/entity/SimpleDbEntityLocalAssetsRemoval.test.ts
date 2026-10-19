import { SimpleDbEntityAccountValue } from './SimpleDbEntityAccountValue';
import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

function withMemoryStorage<T extends object>(entity: T) {
  let saved: unknown = null;
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

const token = (value: string) => ({
  hasAssets: true,
  tokenList: [],
  smallBalanceTokenList: [],
  riskyTokenList: [],
  tokenListMap: {},
  tokenListValue: value,
  currency: 'usd',
});

// Deleting an account's local privacy data must drop the composed balance the
// shared caches hold, and nothing else.
describe('removing one account from the shared asset caches', () => {
  it('drops the token list of that account on that network only', async () => {
    const entity = withMemoryStorage(new SimpleDbEntityLocalTokens());
    await entity.updateAccountTokenList({
      networkId: 'zec--0',
      xpub: 'xpub-a',
      ...token('10'),
    });
    await entity.updateAccountTokenList({
      networkId: 'evm--1',
      accountAddress: '0xabc',
      ...token('20'),
    });

    await entity.removeAccountTokenList({
      networkId: 'zec--0',
      accountAddress: 't1-a',
      xpub: 'xpub-a',
    });

    const raw = await entity.getRawData();
    expect(Object.keys(raw?.tokenListValue ?? {})).toEqual(['evm--1_0xabc']);
    expect(raw?.tokenListHasAssets).toEqual({ 'evm--1_0xabc': true });
  });

  it('drops that network from the single and All Networks worth', async () => {
    const entity = withMemoryStorage(new SimpleDbEntityAccountValue());
    await entity.updateAccountValue({
      networkId: 'xmr--0',
      accountAddress: '4abc',
      value: '5',
      currency: 'usd',
    });
    await entity.updateAllNetworkAccountValue({
      items: [
        { accountAddress: '4abc', networkId: 'xmr--0', value: '5' },
        { accountAddress: '4abc', networkId: 'evm--1', value: '7' },
      ],
      currency: 'usd',
    });

    await entity.removeAccountNetworkValue({
      networkId: 'xmr--0',
      accountAddress: '4abc',
    });

    const raw = await entity.getRawData();
    expect(raw?.byAddress['xmr--0_4abc']).toBeUndefined();
    expect(raw?.allByAddress['4abc'].value).toEqual({ 'evm--1': '7' });
  });
});
