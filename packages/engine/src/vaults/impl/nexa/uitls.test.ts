import { signEncodedTx } from './utils';

import type { Signer } from '../../../proxy';
import { DBAccount } from '../../../types/account';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa Utils Tests', () => {
  it('Nexa Utils signEncodedTx', async () => {
    const signedTx = await signEncodedTx(
      {
        'inputs': [],
        'outputs': [],
        'payload': {
          'encodedTx': {
            'inputs': [
              {
                'txId':
                  'b33f172176b8e901c36f060bdaf332087924aaeddb2e4b483c9b74edc53cc078',
                'outputIndex': 0,
                'satoshis': 10000,
                'address':
                  'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
              },
              {
                'txId':
                  'a1164e3713a8c6fd794a289680b075181c4284b9da8c8c0b9ae864bbcf9b8458',
                'outputIndex': 0,
                'satoshis': 50000,
                'address':
                  'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
              },
              {
                'txId':
                  '86e221c03aa9e7b95b58ef0c7938c5dbcaa6ae736f3f41deb968cffbcaa427ba',
                'outputIndex': 0,
                'satoshis': 5000,
                'address':
                  'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
              },
              {
                'txId':
                  '0ec395ff9213bd4726b91d682246177ccbc99f7459eafac6b69fc8a22c744539',
                'outputIndex': 0,
                'satoshis': 50000,
                'address':
                  'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
              },
            ],
            'outputs': [
              {
                'address':
                  'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
                'fee': '50',
                'outType': 1,
              },
            ],
            'totalFee': '50',
            'transferInfo': {
              'from':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
              'to': 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
              'amount': '50',
            },
          },
        },
        'encodedTx': {
          'inputs': [
            {
              'txId':
                'b33f172176b8e901c36f060bdaf332087924aaeddb2e4b483c9b74edc53cc078',
              'outputIndex': 0,
              'satoshis': 10000,
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                'a1164e3713a8c6fd794a289680b075181c4284b9da8c8c0b9ae864bbcf9b8458',
              'outputIndex': 0,
              'satoshis': 50000,
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                '86e221c03aa9e7b95b58ef0c7938c5dbcaa6ae736f3f41deb968cffbcaa427ba',
              'outputIndex': 0,
              'satoshis': 5000,
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                '0ec395ff9213bd4726b91d682246177ccbc99f7459eafac6b69fc8a22c744539',
              'outputIndex': 0,
              'satoshis': 50000,
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
              'fee': '50',
              'outType': 1,
            },
          ],
          'totalFee': '50',
          'transferInfo': {
            'from': 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            'to': 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
            'amount': '50',
          },
        },
      },
      {
        getPrvkey: () =>
          Promise.resolve(
            Buffer.from(
              '55a8021920dcc897b189bd8c1bd40205c977dd2068b880fc94f984eaf3db40ef',
              'hex',
            ),
          ),
        getPubkey: () =>
          Promise.resolve(
            Buffer.from(
              '02f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2',
              'hex',
            ),
          ),
      } as unknown as Signer,
      {
        address: 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
      } as unknown as DBAccount,
    );
    expect(signedTx.txid).toBe(
      '1e04ea46dbbddf5291df961bf02f4d9158e0e90421379165c6a0b5fe897b9f33',
    );
    expect(signedTx.rawTx).toBe(
      '00040078c03cc5ed749b3c484b2edbedaa24790832f3da0b066fc301e9b87621173fb364222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff10270000000000000058849bcfbb64e89a0b8c8cdab984421c1875b08096284a79fdc6a813374e16a164222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff50c300000000000000ba27a4cafbcf68b9de413f6f73aea6cadbc538790cef585bb9e7a93ac021e28664222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff8813000000000000003945742ca2c89fb6c6faea59749fc9cb7c174622681db92647bd1392ff95c30e64222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff50c30000000000000201881300000000000017005114771aa48fdf8abb07ed22dc23774c5e69990c2ae701fda501000000000017005114fff72bf1654f0505d4a588b76d2b6728dca4097c00000000',
    );
  });
});

export {};
