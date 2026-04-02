import { verifyEvmSignedTxMatched } from './verify';

import type { IVerifyEvmSignedTxMatchedParams } from './verify';

// yarn jest packages/core/src/chains/evm/sdkEvm/verify.test.ts

const legacyTxParams: IVerifyEvmSignedTxMatchedParams = {
  signerAddress: '0x5618207d27D78F09f61A5D92190d58c453feB4b7',
  rawTx:
    '0xf866819b83bebc2082639e945618207d27d78f09f61a5d92190d58c453feb4b7808083014986a0fcae618a8adaf5a9b0c70a8721c78f72e30117655fdada23b90367a19f1ca425a0382459be16c10a4f64bf8c8c60f85e72bb48714507a238bfbd6ede1b4988e9dc',
  txid: '0x29b9640ba410c43ac611e0c18bb4ac7def438e3704d59126a6e676b260d72742',
  signature: {
    r: '0xfcae618a8adaf5a9b0c70a8721c78f72e30117655fdada23b90367a19f1ca425',
    s: '0x382459be16c10a4f64bf8c8c60f85e72bb48714507a238bfbd6ede1b4988e9dc',
    v: '0x00014986',
  },
};

const eip1559TxParams: IVerifyEvmSignedTxMatchedParams = {
  'signerAddress': '0x5618207d27D78F09f61A5D92190d58c453feB4b7',
  'rawTx':
    '0x02f86f818982018d8507a1d71b008507a26fb180825208945618207d27d78f09f61a5d92190d58c453feb4b78080c080a0378a03ed4261c2afd6afbabb3fada93d12422180385dc89413e341e61ed5b14da056a7e9e8cef78a38e0e4b74b1c9e5f34b479c3ce7f13181a020859b9fcb6a8be',
  'txid': '0xd16bddad4d093afff1a2df15a66530d93ce895a30ab7a7cbc8c627fd51af7b07',
  'signature': {
    'r': '0x378a03ed4261c2afd6afbabb3fada93d12422180385dc89413e341e61ed5b14d',
    's': '0x56a7e9e8cef78a38e0e4b74b1c9e5f34b479c3ce7f13181a020859b9fcb6a8be',
    'v': '00',
  },
};

describe('verifyEvmSignedTxMatched', () => {
  // legacy tx ----------------------------------------------
  it('legacy tx: verify OK', () => {
    expect(() => verifyEvmSignedTxMatched(legacyTxParams)).not.toThrow();
  });
  it('legacy tx: txid not match', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...legacyTxParams, txid: '1111' }),
    ).toThrow(/^EVM txid not match/);
  });
  it('legacy tx: address not match', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...legacyTxParams, signerAddress: '1111' }),
    ).toThrow(/^EVM Signer address not match/);
  });
  it('legacy tx: txid not match by empty string', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...legacyTxParams, txid: '' }),
    ).toThrow(/^EVM txid not match/);
  });
  it('legacy tx: address not match by empty string', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...legacyTxParams, signerAddress: '' }),
    ).toThrow(/^EVM Signer address not match/);
  });

  // eip1559 tx ----------------------------------------------
  it('eip1559 tx: verify OK', () => {
    expect(() => verifyEvmSignedTxMatched(eip1559TxParams)).not.toThrow();
  });
  it('eip1559 tx: txid not match', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...eip1559TxParams, txid: '1111' }),
    ).toThrow(/^EVM txid not match/);
  });
  it('eip1559 tx: address not match', () => {
    expect(() =>
      verifyEvmSignedTxMatched({ ...eip1559TxParams, signerAddress: '1111' }),
    ).toThrow(/^EVM Signer address not match/);
  });
});
