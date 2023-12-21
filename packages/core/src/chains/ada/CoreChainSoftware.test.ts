import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

const {
  hdCredential,
  // password,
  networkInfo,
  hdAccountTemplate,
  hdAccounts,
  txSamples,
  msgSamples,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo: {
    networkChainCode: 'ada',
    chainId: '0',
    networkId: 'ada--0',
    networkImpl: 'ada',
    isTestnet: false,
  },
  hdAccountTemplate: "m/1852'/1815'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      path: "m/1852'/1815'/0'",
      address:
        'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
      addresses: {
        '0/0':
          'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
        '2/0': 'stake1u8a9k6c2yghu3spyme3nr57s97r0n37v27l2pnrzj4hplycqusrgq',
      },
      publicKey: '',
      privateKeyRaw:
        'c05104afff8b35765fa862267bb3ac325dac7d540d5b67208852144e1c9689420cc85321801f548f06f57a79a3b51e7fa63de2f78ed2c53f851436eeca34c531b26be5c118159882386e2b301486108a9d92cc7346c419f3f8e0fc74e89b0fe3c3c81ca61635db3464f15301413b92747a37c9c1ddb998f1257496903dc5589030',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'inputs': [
          {
            'address':
              'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
            'tx_hash':
              '4e100c680d812748874ec2071a6cd4cce84e8672de813794b10d0691b37b9b18',
            'tx_index': 0,
            'output_index': 0,
            'amount': [{ 'unit': 'lovelace', 'quantity': '1000000' }],
            'datum_hash': null,
            'reference_script_hash': null,
            'path': "m/1852'/1815'/0'/0/0",
            'txHash':
              '4e100c680d812748874ec2071a6cd4cce84e8672de813794b10d0691b37b9b18',
            'outputIndex': 0,
          },
          {
            'address':
              'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
            'tx_hash':
              '58a0a5d73dc635001c6076c0818f55c44248d6b19840840ab462332af6a55b56',
            'tx_index': 0,
            'output_index': 0,
            'amount': [{ 'unit': 'lovelace', 'quantity': '1100000' }],
            'datum_hash': null,
            'reference_script_hash': null,
            'path': "m/1852'/1815'/0'/0/0",
            'txHash':
              '58a0a5d73dc635001c6076c0818f55c44248d6b19840840ab462332af6a55b56',
            'outputIndex': 0,
          },
        ],
        'outputs': [
          {
            'address':
              'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
            'amount': '1000000',
            'assets': [],
          },
        ],
        'fee': '1100000',
        'totalSpent': '2100000',
        'totalFeeInNative': '1.1',
        'transferInfo': {
          'from':
            'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
          'to': 'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
          'amount': '1',
          'token': '',
          'networkId': 'ada--0',
          'accountId': "hd-2--m/1852'/1815'/0'",
          'ignoreInscriptions': false,
        },
        'tx': {
          'body':
            'a300828258204e100c680d812748874ec2071a6cd4cce84e8672de813794b10d0691b37b9b180082582058a0a5d73dc635001c6076c0818f55c44248d6b19840840ab462332af6a55b56000181825839013e3056ea3325e354b0b8f54e18704593b08354ff4ff0b3669bf4808ffa5b6b0a222fc8c024de6331d3d02f86f9c7cc57bea0cc62956e1f931a000f4240021a0010c8e0',
          'hash':
            '91e66c9cf210e66331d34dfc0c7829f8880bd4a4f7d9f1c95d75efd38a51df95',
          'size': 255,
        },
        'changeAddress': {
          'address':
            'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
          'addressParameters': {
            'path': "m/1852'/1815'/0'/0/0",
            'addressType': 0,
            'stakingPath': "m/1852'/1815'/0'/2/0",
          },
        },
        'signOnly': false,
      } as any,
      signedTx: {
        'encodedTx': null,
        'txid':
          '91e66c9cf210e66331d34dfc0c7829f8880bd4a4f7d9f1c95d75efd38a51df95',
        'rawTx':
          '84a300828258204e100c680d812748874ec2071a6cd4cce84e8672de813794b10d0691b37b9b180082582058a0a5d73dc635001c6076c0818f55c44248d6b19840840ab462332af6a55b56000181825839013e3056ea3325e354b0b8f54e18704593b08354ff4ff0b3669bf4808ffa5b6b0a222fc8c024de6331d3d02f86f9c7cc57bea0cc62956e1f931a000f4240021a0010c8e0a1008182582017c1b345186bb3b96b7b6506ed70bf54692bb1e66665326223441580b7d04bdb58404473f2d8acfda1fc762e0ffe604e5881f794ef903418ccde8e8aa1700c7f3c12731f7ddc4a7ba539d85258350f31b8e5b114d58c20cbb8c08ee71fb33b4b7600f5f6',
      },
    },
  ],
  msgSamples: [],
});

// wasm module
// yarn jest packages/core/src/chains/ada/CoreChainSoftware.test.ts
describe('ADA Core tests', () => {
  it('mnemonic verify', () => {
    coreTestsUtils.expectMnemonicValid({
      hdCredential,
    });
  });
  it('getAddressFromPublic', async () => {
    // ADA use getAddressFromPrivate instead.
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

  it('signTransaction', async () => {
    const coreApi = new CoreChainHd();
    // TODO Linking failure in asm.js: Unexpected stdlib member

    await coreTestsUtils.expectSignTransactionOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      txSamples,
    });
  });
  it.skip('signMessage', async () => {
    const coreApi = new CoreChainHd();
    // TODO Linking failure in asm.js: Unexpected stdlib member

    await coreTestsUtils.expectSignMessageOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      msgSamples,
    });
  });
});
