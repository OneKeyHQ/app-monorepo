import { coinSelect, coinSelectForOrdinal } from './coinSelectUtils';

import type { ICoinSelectUTXO } from '../types';
/*
{"inputsForCoinSelect":[
{"txId":"3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782","vout":2,"value":600,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},

{"txId":"3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782","vout":3,"value":4828315,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},

{"txId":"27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e881","vout":2,"value":1,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},

{"txId":"9434aad9c453a10aece06ee2dc87599486f6e6a6b0b8799c009922f755aa0977","vout":0,"value":541,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},{"txId":"746809f97e10b0d07c551fd3cd43fdecdf6fd616efd4f0be39bfd7bbee2a230a","vout":0,"value":2929455,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},{"txId":"5f180bcbbfa1aa9b92959d32cae7b2c0448621c53799963c463dbd72c80a0595","vout":0,"value":100000,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},{"txId":"f7f667c9bc423123225026102a0432bea8da9d8c05479fec52dc389e0b5d296b","vout":1,"value":9757,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"},{"txId":"017ca89f5aae8ca49c485afd481680aebbfae6cc6844665538b43330498e48b4","vout":1,"value":1366065,"address":"2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj","path":"m/49'/1'/0'/0/0"}],"outputsForCoinSelect":[{"address":"2MyATx6Pmmo5FuqB9EAGBrEZBVafus1KgVe","value":800000}],"feeRate":"1"}
 */

function simpleTransferCoinSelect({
  inputValue,
  outputValue,
}: {
  inputValue: number;
  outputValue: number;
}) {
  return coinSelect({
    'inputsForCoinSelect': [
      {
        'txId':
          '3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782',
        'vout': 2,
        'value': inputValue,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
    ],
    'outputsForCoinSelect': [
      {
        'address': '2MyATx6Pmmo5FuqB9EAGBrEZBVafus1KgVe',
        'value': outputValue,
      },
    ],
    'feeRate': '1',
  });
}
describe('coinSelect tests', () => {
  it('just fit input value', () => {
    const result = simpleTransferCoinSelect({
      inputValue: 738,
      outputValue: 546,
    });

    expect(result.inputs?.length).toBeGreaterThan(0);
    expect(result.outputs?.length).toBeGreaterThan(0);
    expect(result.fee).toBeGreaterThan(0);
  });

  it('insufficient input value', () => {
    const result = simpleTransferCoinSelect({
      inputValue: 738 - 1,
      outputValue: 546,
    });

    expect(result.inputs).toBe(undefined);
    expect(result.outputs).toBe(undefined);
    expect(result.fee).toBeGreaterThan(0);
  });

  it('split: max transfer', () => {
    const inputsForCoinSelect = [
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e881',
        'vout': 1,
        'value': 600,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782',
        'vout': 2,
        'value': 10000,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '746809f97e10b0d07c551fd3cd43fdecdf6fd616efd4f0be39bfd7bbee2a230a',
        'vout': 3,
        'value': 750,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
    ];
    const outputsForCoinSelect = [
      {
        address:
          'tb1p7aq8zw9ch8cw2nqtdmfguyjaqfw95neje25suf4avq63ysrhmmusea5uqk',
        isMax: true,
      },
      {
        address: '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        value: 546,
      },
    ];

    const result = coinSelect({
      algorithm: 'split',
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '1',
    });

    expect(result.inputs?.length).toEqual(3);
    expect(result.outputs?.[0].value).toEqual(10282);
  });

  it('blackjack: ', () => {
    const inputsForCoinSelect = [
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e881',
        'vout': 1,
        'value': 600,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782',
        'vout': 2,
        'value': 10000,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '746809f97e10b0d07c551fd3cd43fdecdf6fd616efd4f0be39bfd7bbee2a230a',
        'vout': 3,
        'value': 750,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
    ];
    const outputsForCoinSelect = [
      {
        'address': '2MyATx6Pmmo5FuqB9EAGBrEZBVafus1KgVe',
        'value': 2546,
      },
    ];
    const result = coinSelect({
      algorithm: 'blackjack',
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '1',
    });
    expect(result.inputs).toEqual(undefined);
  });

  it('accumulative: should always use first utxo', () => {
    const inputsForCoinSelect: ICoinSelectUTXO[] = [
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e999',
        'vout': 0,
        'value': 580,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e881',
        'vout': 1,
        'value': 560,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
        // forceSelect: true, // ordinal utxo flag
      },
      {
        'txId':
          '3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782',
        'vout': 2,
        'value': 10000,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
        forceSelect: true,
      },
      {
        'txId':
          '746809f97e10b0d07c551fd3cd43fdecdf6fd616efd4f0be39bfd7bbee2a230a',
        'vout': 3,
        'value': 1750,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
    ];
    const outputsForCoinSelect = [
      {
        'address': '2MyATx6Pmmo5FuqB9EAGBrEZBVafus1KgVe',
        'value': 546,
      },
    ];

    let result = coinSelect({
      algorithm: 'accumulative',
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '1',
    });

    expect(result.inputs?.[0].txId).toEqual(inputsForCoinSelect[0].txId);

    result = coinSelect({
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '1',
    });

    expect(result.inputs?.[0].txId).toEqual(inputsForCoinSelect[0].txId);
  });

  it('should ordinal utxo always be sorted first', () => {
    const inputsForCoinSelect: ICoinSelectUTXO[] = [
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e999',
        'vout': 0,
        'value': 580,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
      {
        'txId':
          '27f75e15c9495ffd22771d71fdb8642581597bd46cea9fe07e1e7e90b0a7e881',
        'vout': 1,
        'value': 560,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
        // forceSelect: true, // ordinal utxo flag
      },
      {
        'txId':
          '3a33c8b58b8990e6db981001b1685b66bd88fb161fb339f67548330f024e4782',
        'vout': 2,
        'value': 10000,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
        forceSelect: true,
      },
      {
        'txId':
          '746809f97e10b0d07c551fd3cd43fdecdf6fd616efd4f0be39bfd7bbee2a230a',
        'vout': 3,
        'value': 1750,
        'address': '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        'path': "m/49'/1'/0'/0/0",
      },
    ];
    const outputsForCoinSelect = [
      {
        'address': '2MyATx6Pmmo5FuqB9EAGBrEZBVafus1KgVe',
        'value': 10000,
      },
    ];

    const forceSelectUtxoTxid = inputsForCoinSelect.find(
      (item) => !!item.forceSelect,
    )?.txId;
    const result = coinSelectForOrdinal({
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '1',
    });
    expect(result.inputs?.[0].txId).toEqual(forceSelectUtxoTxid);
  });

  it('blackjack pro full tests', () => {
    // TODO
  });
});
