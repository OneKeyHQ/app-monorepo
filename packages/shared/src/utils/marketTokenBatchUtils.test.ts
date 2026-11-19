import { toMarketTokenBatchRequestItems } from './marketTokenBatchUtils';

describe('toMarketTokenBatchRequestItems', () => {
  it('drops listing ids and other fields the batch endpoint rejects', () => {
    const recommendToken = {
      chainId: 'btc--0',
      contractAddress: '',
      isNative: true,
      assetId: 'btc',
      stockId: 'stock-1',
    };

    expect(toMarketTokenBatchRequestItems([recommendToken])).toEqual([
      { chainId: 'btc--0', contractAddress: '', isNative: true },
    ]);
  });

  it('keeps order and the contract fields of every item', () => {
    expect(
      toMarketTokenBatchRequestItems([
        { chainId: 'evm--1', contractAddress: '0xabc', isNative: false },
        { chainId: 'sol--101', contractAddress: '', isNative: true },
      ]),
    ).toEqual([
      { chainId: 'evm--1', contractAddress: '0xabc', isNative: false },
      { chainId: 'sol--101', contractAddress: '', isNative: true },
    ]);
  });
});
