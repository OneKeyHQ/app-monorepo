import assert from 'assert';

import { Connection, getTransaction } from '@mysten/sui.js';

import { OneKeyJsonRpcProvider } from '../provider/OnekeyJsonRpcProvider';
import { GAS_TYPE_ARG } from '../utils';

import { parseTransferObjects } from './Transaction';

jest.setTimeout(3 * 60 * 1000);

describe('Sui parse Transaction Tests', () => {
  const mainnetClient = new OneKeyJsonRpcProvider(
    new Connection({
      fullnode: 'https://fullnode.mainnet.sui.io',
      faucet: 'https://faucet.testnet.sui.io/gas',
    }),
  );

  // const testnetClient = new OneKeyJsonRpcProvider(
  //   new Connection({
  //     fullnode: 'https://fullnode.testnet.sui.io',
  //     faucet: 'https://faucet.testnet.sui.io/gas',
  //   }),
  // );

  it('Sui parse TransferObjects (normal Native Transfer)', async () => {
    // #region Tx data
    const suiTransactionBlock = getTransaction({
      'digest': 'HtiGHrccFQZbKbeoLGLxq68PHh52DQ9cs4RziasaNwCS',
      'transaction': {
        'data': {
          'messageVersion': 'v1',
          'transaction': {
            'kind': 'ProgrammableTransaction',
            'inputs': [
              { 'type': 'pure', 'valueType': 'u64', 'value': '1000000000' },
              {
                'type': 'pure',
                'valueType': 'address',
                'value':
                  '0x15e3495578be8f5d981d25e82e4acda827081b81755ff8d9dbfca68827456dc3',
              },
            ],
            'transactions': [
              { 'SplitCoins': ['GasCoin', [{ 'Input': 0 }]] },
              { 'TransferObjects': [[{ 'Result': 0 }], { 'Input': 1 }] },
            ],
          },
          'sender':
            '0x2ef7b17e1c4a8a411472dde9516ed31ea9b235eeccdd3ebebd887b9f6b90428b',
          'gasData': {
            'payment': [
              {
                'objectId':
                  '0x2d6ddfe481d21453deffb8196ec6fdef8d2f669b61155d3d808db6cbe522cb5a',
                'version': 1674256,
                'digest': 'Erp2s56A8SdQrmHpHcdLf4Yn43rgJsgpE6TMAq6ZhVg7',
              },
            ],
            'owner':
              '0x2ef7b17e1c4a8a411472dde9516ed31ea9b235eeccdd3ebebd887b9f6b90428b',
            'price': '1000',
            'budget': '3976000',
          },
        },
        'txSignatures': [
          'APWY9gzBlZRwQ5R3CmkdDQb2+sSFl8KDC86a9S+2MmZx7NSWSyU420pcYfPCKY5M+8eCfbZfyEQ4IiCoKYWiMQNqR3aZ8WteQpJJ02UE/fTPym0LT4b0gqMiuLKjn0lMNA==',
        ],
      },
      'balanceChanges': [
        {
          'owner': {
            'AddressOwner':
              '0x15e3495578be8f5d981d25e82e4acda827081b81755ff8d9dbfca68827456dc3',
          },
          'coinType': '0x2::sui::SUI',
          'amount': '1000000000',
        },
        {
          'owner': {
            'AddressOwner':
              '0x2ef7b17e1c4a8a411472dde9516ed31ea9b235eeccdd3ebebd887b9f6b90428b',
          },
          'coinType': '0x2::sui::SUI',
          'amount': '-1001997880',
        },
      ],
      'timestampMs': '1683358325265',
      'checkpoint': '1802444',
    })?.data;

    const transactionData = suiTransactionBlock?.transaction;
    const payment = suiTransactionBlock?.gasData.payment;
    if (
      !transactionData ||
      transactionData.kind !== 'ProgrammableTransaction'
    ) {
      throw new Error('current transaction is empty, continue');
    }

    // #endregion

    const transactionActions = transactionData.transactions;
    // console.log(transactionData);

    for (const action of transactionActions) {
      if ('TransferObjects' in action) {
        const transferObjects = action.TransferObjects;
        const details = await parseTransferObjects({
          argument: transferObjects,
          actions: transactionActions,
          inputs: transactionData.inputs,
          payments: payment,
          client: mainnetClient,
        });

        assert.equal(
          details.receive,
          '0x15e3495578be8f5d981d25e82e4acda827081b81755ff8d9dbfca68827456dc3',
        );
        assert.equal(details.amounts.get(GAS_TYPE_ARG), '1000000000');
      }
    }
  });

  it('Sui parse TransferObjects (payAll Native Transfer)', async () => {
    // #region Tx data
    const suiTransactionBlock = getTransaction({
      'digest': '91a6Vgoho5FqfxG1bLpB8V3x3CC9k8D4U7schhMhcGci',
      'transaction': {
        'data': {
          'messageVersion': 'v1',
          'transaction': {
            'kind': 'ProgrammableTransaction',
            'inputs': [
              {
                'type': 'pure',
                'valueType': 'address',
                'value':
                  '0x1f7b27844f2c4a0262b2c481f7ab956d10ace524c5a7b06c3742cfb8701db714',
              },
            ],
            'transactions': [
              { 'TransferObjects': [['GasCoin'], { 'Input': 0 }] },
            ],
          },
          'sender':
            '0x8c781ba50920af15070ca661c2135aaf88f6fa226b6e1a62b372a4f751b8c849',
          'gasData': {
            'payment': [
              {
                'objectId':
                  '0x605e733bd77b764e755618dd99172c1f13c0f9260309eeb515a4dc4e4393fb48',
                'version': 1596604,
                'digest': '2h2JhTccaixMffBFLEfBFbUBHb9csjd2ZWSJosFa5xef',
              },
            ],
            'owner':
              '0x8c781ba50920af15070ca661c2135aaf88f6fa226b6e1a62b372a4f751b8c849',
            'price': '1000',
            'budget': '2976000',
          },
        },
        'txSignatures': [
          'AGxlCvhT+PqOUzajCj94HXzHRle9nv3gajXMWCKnlkFxKQ9bu3fFWIq3OEyw1egvrAl7lHywj8cK0zO+n3QSdQkjltKyinBhmrSFvtTwGqQ4iZ+VdaoLWba3KglvFiu0Lw==',
        ],
      },
      'timestampMs': '1683377589513',
      'checkpoint': '1820584',
    })?.data;

    const transactionData = suiTransactionBlock?.transaction;
    const payment = suiTransactionBlock?.gasData.payment;
    if (
      !transactionData ||
      transactionData.kind !== 'ProgrammableTransaction'
    ) {
      throw new Error('current transaction is empty, continue');
    }

    // #endregion

    const transactionActions = transactionData.transactions;
    // console.log(JSON.stringify(transactionData, null, 2));

    for (const action of transactionActions) {
      if ('TransferObjects' in action) {
        const transferObjects = action.TransferObjects;
        const details = await parseTransferObjects({
          argument: transferObjects,
          actions: transactionActions,
          inputs: transactionData.inputs,
          payments: payment,
          client: mainnetClient,
        });

        assert.equal(
          details.receive,
          '0x1f7b27844f2c4a0262b2c481f7ab956d10ace524c5a7b06c3742cfb8701db714',
        );
        // assert.equal(details.amounts.get(GAS_TYPE_ARG), '233516240000');
      }
    }
  });

  it('Sui parse TransferObjects (Token Transfer)', async () => {
    // #region Tx data
    const suiTransactionBlock = getTransaction({
      'digest': 'AtfMUwMp6pPDgx6iFUjWtcNsGeakm8VXUTxEcSKshgHN',
      'transaction': {
        'data': {
          'messageVersion': 'v1',
          'transaction': {
            'kind': 'ProgrammableTransaction',
            'inputs': [
              {
                'type': 'object',
                'objectType': 'immOrOwnedObject',
                'objectId':
                  '0x00ae9484570db798e1cf48184ec3ed80489c7848acbf6991a5a66815894b36a4',
                'version': '1998817',
                'digest': 'EnLqZrQhmiFoDHW6jUJebT31s8uVT2W6rAyB22Nh1YZA',
              },
              { 'type': 'pure', 'valueType': 'u64', 'value': '10000' },
              {
                'type': 'pure',
                'valueType': 'address',
                'value':
                  '0xe40a5a0133cac4e9059f58f9d2074a3386d631390e40eadb43d2606e8975f3eb',
              },
            ],
            'transactions': [
              { 'SplitCoins': [{ 'Input': 0 }, [{ 'Input': 1 }]] },
              { 'TransferObjects': [[{ 'Result': 0 }], { 'Input': 2 }] },
            ],
          },
          'sender':
            '0x20bc56200b85adb47bed5f4b66c31d7789809f2b87130090fd7a6e8b936be076',
          'gasData': {
            'payment': [
              {
                'objectId':
                  '0xa4ec40c4120e5b21c0845cfbf2ab1c3dcec7fed77e59bddbc866fd3423fb6d57',
                'version': 1998817,
                'digest': '6VAP4BHhQUXkktLbY3N1tu2CaatyQNX9L2rckmZup7JH',
              },
            ],
            'owner':
              '0x20bc56200b85adb47bed5f4b66c31d7789809f2b87130090fd7a6e8b936be076',
            'price': '990',
            'budget': '4303624',
          },
        },
        'txSignatures': [
          'ADyOowvitpVgucV4iraYr7ATE7MPUvqKdJMdWmf+G6SzdrRlAonRhDZmNvgpaiIQn9SRHTQW2hkRaNESKuJWUwRGIPrOH6UtU0/9W/qRweHRMf5woc8iiFlnjS38tTuEgA==',
        ],
      },
      'timestampMs': '1683524915954',
      'checkpoint': '1960820',
    })?.data;

    const transactionData = suiTransactionBlock?.transaction;
    const payment = suiTransactionBlock?.gasData.payment;
    if (
      !transactionData ||
      transactionData.kind !== 'ProgrammableTransaction'
    ) {
      throw new Error('current transaction is empty, continue');
    }

    // #endregion

    const transactionActions = transactionData.transactions;
    // console.log(JSON.stringify(transactionData, null, 2));

    for (const action of transactionActions) {
      if ('TransferObjects' in action) {
        const transferObjects = action.TransferObjects;
        const details = await parseTransferObjects({
          argument: transferObjects,
          actions: transactionActions,
          inputs: transactionData.inputs,
          payments: payment,
          client: mainnetClient,
        });

        assert.equal(
          details.receive,
          '0xe40a5a0133cac4e9059f58f9d2074a3386d631390e40eadb43d2606e8975f3eb',
        );
        assert.equal(
          details.amounts.get(
            '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
          ),
          '10000',
        );
      }
    }
  });
});
