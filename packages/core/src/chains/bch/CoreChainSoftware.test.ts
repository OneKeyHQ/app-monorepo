import { Transaction, payments } from 'bitcoinjs-lib';

import { NotImplemented } from '@onekeyhq/shared/src/errors';

import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { getBitcoinECPair, initBitcoinEcc } from '../btc/sdkBtc';
import { getBtcForkNetwork } from '../btc/sdkBtc/networks';

import CoreChainHd from './CoreChainHd';

const {
  hdCredential,
  // password,
  networkInfo,
  hdAccountTemplate,
  hdAccounts,
  txSamples,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo: {
    networkChainCode: 'bch',
    chainId: '0',
    networkId: 'bch--0',
    networkImpl: 'bch',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/145'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      addresses: {
        '0/0': 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      },
      path: "m/44'/145'/0'",
      relPaths: ['0/0'],
      xpub: 'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEKAMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH',
      xpvtRaw:
        '0488ade403a5fb656980000000b5ac535a2528d4641f006a3170b5cde3810f47d2f27872e1faac0798dd9eb07f0067eb4917b9f4d446d31b2ba3db99fe4c55c39f6d4ca024f18016af865548cd86',
      publicKey:
        '023342708de6a3557949806aa20f4a2d37e4e3e8a3314ebc211e0ef99b98234763',
      privateKeyRaw:
        '72f3446b193e0ebd2755f57d1c5d10b08f53b8e598e9fb236af231a5b7f82bbe',
    },
  ],
  txSamples: [
    {
      encodedTx: '',
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'rawTx': '',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/bch/CoreChainSoftware.test.ts
describe('BCH Core tests', () => {
  it('uses the BCH forkId signer and preserves its transaction vector', () => {
    initBitcoinEcc();
    const ECPair = getBitcoinECPair();
    const key = ECPair.fromPrivateKey(Buffer.alloc(32, 1));
    const script = payments.p2pkh({ pubkey: key.publicKey }).output!;
    const parent = new Transaction();
    parent.addInput(Buffer.alloc(32, 3), 0);
    parent.addOutput(script, 100_000n);
    const psbt = new CoreChainHd().getPsbt({
      network: getBtcForkNetwork('bch'),
    });
    psbt.addInput({
      hash: parent.getHash(),
      index: 0,
      nonWitnessUtxo: parent.toBuffer(),
    });
    psbt.addOutput({ script, value: 99_000n });
    psbt.signInput(0, key);
    expect(psbt.data.inputs[0].partialSig?.[0].signature.at(-1)).toBe(0x41);
    expect(
      psbt.validateSignaturesOfInput(0, (pubkey, hash, signature) =>
        ECPair.fromPublicKey(Buffer.from(pubkey)).verify(
          Buffer.from(hash),
          Buffer.from(signature),
        ),
      ),
    ).toBe(true);
    expect(psbt.finalizeAllInputs().extractTransaction().toHex()).toBe(
      '0200000001b603d6c490bacf4f5ed31809fd1b539164f39e45e4f02049c802b63bf152b788000000006a473044022063b3d3c68e546c7b7cf84e10ad9766e3a079153771b540b07990d534f0ccd3ce02200b8a10cf6c7b9d65482096f6bb9204d6ffbaa6c9870a684d62cf362159d741514121031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078fffffffff01b8820100000000001976a91479b000887626b294a914501a4cd226b58b23598388ac00000000',
    );
    expect(psbt.getFee()).toBe(1000n);
  });

  it('mnemonic verify', async () => {
    await coreTestsUtils.expectMnemonicValid({
      hdCredential,
    });
  });
  it('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressesFromHd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdAccountTemplate,
      hdCredential,
    });
  });
  it('getPrivateKeys hd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdCredential,
    });
  });

  it.skip('signTransaction', async () => {
    const coreApi = new CoreChainHd();
    // TODO bch tx mock
    await coreTestsUtils.expectSignTransactionOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      txSamples,
    });
  });

  it.skip('signMessage', async () => {
    // const coreApi = new CoreChainHd();
    // coreApi.signMessage
    throw new NotImplemented();
  });
});
