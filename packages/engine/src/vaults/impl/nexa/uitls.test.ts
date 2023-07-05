import { reverseBuffer, sign } from './sdk';
import {
  decodeScriptBufferToNexaAddress,
  sha256sha256,
  signEncodedTx,
} from './utils';

import type { Signer } from '../../../proxy';
import type { DBAccount } from '../../../types/account';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa Utils Tests', () => {
  it('Nexa Utils signEncodedTx #1', async () => {
    const signedTx = await signEncodedTx(
      {
        'inputs': [],
        'outputs': [],
        'payload': {},
        'encodedTx': {
          'inputs': [
            {
              'txId':
                'b33f172176b8e901c36f060bdaf332087924aaeddb2e4b483c9b74edc53cc078',
              'outputIndex': 0,
              'satoshis': '10000',
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                'a1164e3713a8c6fd794a289680b075181c4284b9da8c8c0b9ae864bbcf9b8458',
              'outputIndex': 0,
              'satoshis': '50000',
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                '86e221c03aa9e7b95b58ef0c7938c5dbcaa6ae736f3f41deb968cffbcaa427ba',
              'outputIndex': 0,
              'satoshis': '5000',
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
            {
              'txId':
                '0ec395ff9213bd4726b91d682246177ccbc99f7459eafac6b69fc8a22c744539',
              'outputIndex': 0,
              'satoshis': '50000',
              'address':
                'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
              'satoshis': '5000',
              'outType': 1,
            },
          ],
          'gas': undefined,
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

  it('Nexa Utils signEncodedTx #2', async () => {
    const signedTx = await signEncodedTx(
      {
        'inputs': [],
        'outputs': [],
        'payload': {},
        'encodedTx': {
          'inputs': [
            {
              'txId':
                '8e25139e37161728ecfcf1ca736cc66039daa32543c4f6f59c295e10d07dfc88',
              'outputIndex': 1,
              'satoshis': '99758530',
              'address':
                'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
            },
            {
              'txId':
                'ec29ed8b294c307f955b004f1c602bb76fe5363921afd56abdf0476975dbc838',
              'outputIndex': 0,
              'satoshis': '1000',
              'address':
                'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
              'satoshis': '5000',
              'outType': 1,
            },
          ],
          'gas': undefined,
          'transferInfo': {
            'from': 'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
            'to': 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
            'amount': '50',
          },
        },
      },
      {
        getPrvkey: () =>
          Promise.resolve(
            Buffer.from(
              '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
              'hex',
            ),
          ),
        getPubkey: () =>
          Promise.resolve(
            Buffer.from(
              '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
              'hex',
            ),
          ),
      } as unknown as Signer,
      {
        address: 'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
      } as unknown as DBAccount,
    );
    expect(signedTx.txid).toBe(
      'c0a8d7f91b662021ac35040e0ed77d32780ea00cb10622f4e33d5f10e1de5161',
    );
    expect(signedTx.rawTx).toBe(
      '00020088fc7dd0105e299cf5f6c44325a3da3960c66c73caf1fcec281716379e13258e64222103560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c3140ec76707ee9a316e2fddd8c7393f0981a42977b46278fc121556a84d6234c18aa36117960312df325249f144ad1c35c71af72822477e3e61ca2bbab1635f142b3ffffffffc231f205000000000038c8db756947f0bd6ad5af213936e56fb72b601c4f005b957f304c298bed29ec64222103560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c3140ec76707ee9a316e2fddd8c7393f0981a42977b46278fc121556a84d6234c18aa36117960312df325249f144ad1c35c71af72822477e3e61ca2bbab1635f142b3ffffffffe8030000000000000201881300000000000017005114771aa48fdf8abb07ed22dc23774c5e69990c2ae701db1df2050000000017005114ff8684eb63672e395b27643759a34f01f4c6930100000000',
    );
  });

  it('Nexa Utils decodeScriptHexToNexaAddress #1', () => {
    const hex =
      '222103560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c3140302394d39bae3e8b1fe05df664113901ec516dc29a30e5eb913219f70a2ed61d8e7ee53cfedbd30953f4919956edce5710dbfaf5f95c9dc3f6322e7bb17057ff';
    expect(
      decodeScriptBufferToNexaAddress(Buffer.from(hex, 'hex'), 'nexatest'),
    ).toBe('nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv');
  });

  it('Nexa Utils decodeScriptHexToNexaAddress #2', () => {
    const hex = '005114345209375631d693fca3865141cc6de052e11797';
    expect(
      decodeScriptBufferToNexaAddress(Buffer.from(hex, 'hex'), 'nexatest'),
    ).toBe('nexatest:nqtsq5g5x3fqjd6kx8tf8l9rseg5rnrdupfwz9uhauzga026');
  });

  it('Nexa Utils Sgin Transaction', () => {
    const privateKey =
      '91632aaa4de97d24c58ff234aa371c7a7c8363808a73fa9189cb5ee3d55a0cd3';
    const digest =
      'ae11c0c8f2576bd05fcde9d0d1f78f0fdaf679476d499c8cd366b81b476350fc';
    expect(
      sign(Buffer.from(privateKey, 'hex'), Buffer.from(digest, 'hex')).toString(
        'hex',
      ),
    ).toBe(
      '393e482f116e5d7a1343ff48b1e9fedb7ad48d8fb4fc926d73c2b9766084c0491a86cb26b34da6827daf3a3f03f0250f46e2813392b7e0d1feadbeeecc78a6c0',
    );
  });

  it('Nexa Utils Sgin Transaction With signatureBuffer', () => {
    const privateKey =
      '91632aaa4de97d24c58ff234aa371c7a7c8363808a73fa9189cb5ee3d55a0cd3';
    const signatureBuffer =
      '006907059db8bb0c87e295c0bfe3619455484a9c2b13faea2ba6daace8b743d32918fe568a8c5de81c57cf295e9b31ec9b15289631e304cc73b4e60a720fc4a9e5752adad0a7b9ceca853768aebb6965eca126a62965f698a0c1bc43d83db632ad026cadf4e5fc9d566e3d75acc1004b9ddf43dd7006c1470124ac894d7b3f9b44ea9a780000000000';
    const digest = reverseBuffer(
      sha256sha256(Buffer.from(signatureBuffer, 'hex')),
    );
    expect(sign(Buffer.from(privateKey, 'hex'), digest).toString('hex')).toBe(
      '78aba6cb5841f1c67f523d05149ebfde0b5f8fc3b17b989de070936aa3c01cc04301779b0ec2306e6e2ddaa85b2c7b9814309d41b2c8530fc3eaed927d179473',
    );
  });
});

export {};
