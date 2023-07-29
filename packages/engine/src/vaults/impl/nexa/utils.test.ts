import { sign, verify } from './sdk';
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
      'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
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
      'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
    );
    expect(signedTx.txid).toBe(
      'c0a8d7f91b662021ac35040e0ed77d32780ea00cb10622f4e33d5f10e1de5161',
    );
    expect(signedTx.rawTx).toBe(
      '00020088fc7dd0105e299cf5f6c44325a3da3960c66c73caf1fcec281716379e13258e64222103560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c3140ec76707ee9a316e2fddd8c7393f0981a42977b46278fc121556a84d6234c18aa36117960312df325249f144ad1c35c71af72822477e3e61ca2bbab1635f142b3ffffffffc231f205000000000038c8db756947f0bd6ad5af213936e56fb72b601c4f005b957f304c298bed29ec64222103560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c3140ec76707ee9a316e2fddd8c7393f0981a42977b46278fc121556a84d6234c18aa36117960312df325249f144ad1c35c71af72822477e3e61ca2bbab1635f142b3ffffffffe8030000000000000201881300000000000017005114771aa48fdf8abb07ed22dc23774c5e69990c2ae701db1df2050000000017005114ff8684eb63672e395b27643759a34f01f4c6930100000000',
    );
  });

  it('Nexa Utils signEncodedTx #3: Transfer out all the balances.', async () => {
    const signedTx = await signEncodedTx(
      {
        'inputs': [],
        'outputs': [],
        'payload': {},
        'encodedTx': {
          'inputs': [
            {
              'txId':
                '1c5ee6d6f6c6dc9cdb07e9142294fd2135c6e445d75050f8277f5d1d21389b7f',
              'outputIndex': 0,
              'satoshis': '20000',
              'address':
                'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            },
            {
              'txId':
                '9a97e06716c638b1191a335cbbe7619c47815e4d9dd6825c97d8c9756cd72493',
              'outputIndex': 0,
              'satoshis': '20000',
              'address':
                'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            },
            {
              'txId':
                '7ba7d80db1f3e9e94fe654b54bffa5475d90f05ffedb85617c39c9b4ba4de365',
              'outputIndex': 0,
              'satoshis': '20000',
              'address':
                'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            },
            {
              'txId':
                '30753a924d9c9ed91411f20ace809b5879c12f06714152176bf55f66ce9c6e1e',
              'outputIndex': 0,
              'satoshis': '20000',
              'address':
                'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            },
            {
              'txId':
                '1d3fc867415ac5d3a6de7509f4010b23640e2ce1a27cdfe0eee71ed52764f560',
              'outputIndex': 0,
              'satoshis': '10000',
              'address':
                'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g50frur0vav60gupjlrr8cta8vyqufu7p9gskt92mz',
              'satoshis': '90000',
              'outType': 1,
            },
          ],
          'transferInfo': {
            'from': 'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
            'to': 'nexatest:nqtsq5g50frur0vav60gupjlrr8cta8vyqufu7p9gskt92mz',
            'amount': '900',
          },
          'gas': '2409',
        },
      },
      {
        getPrvkey: () =>
          Promise.resolve(
            Buffer.from(
              '3d04eff77414801ce0bc6c73f52af7f198af3e5cba0935c19e9fa25dd383d10e',
              'hex',
            ),
          ),
        getPubkey: () =>
          Promise.resolve(
            Buffer.from(
              '03710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec77',
              'hex',
            ),
          ),
      } as unknown as Signer,
      'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
    );
    expect(signedTx.txid).toBe(
      '3f0e91feeb682422e4fc1fa1ba69e70abfa344a9b0b2b0d5ca06230340ea18f0',
    );
    expect(signedTx.rawTx).toBe(
      '0005007f9b38211d5d7f27f85050d745e4c63521fd942214e907db9cdcc6f6d6e65e1c64222103710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec7740a501f2380cedbac45c09f234659bf3178290cb689fd61473379cd4e96c50b659c86b1e0abea4b18a72b530ffa29f15a0f803c2853858de28e050956fa849888dffffffff204e000000000000009324d76c75c9d8975c82d69d4d5e81479c61e7bb5c331a19b138c61667e0979a64222103710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec7740a501f2380cedbac45c09f234659bf3178290cb689fd61473379cd4e96c50b659c86b1e0abea4b18a72b530ffa29f15a0f803c2853858de28e050956fa849888dffffffff204e0000000000000065e34dbab4c9397c6185dbfe5ff0905d47a5ff4bb554e64fe9e9f3b10dd8a77b64222103710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec7740a501f2380cedbac45c09f234659bf3178290cb689fd61473379cd4e96c50b659c86b1e0abea4b18a72b530ffa29f15a0f803c2853858de28e050956fa849888dffffffff204e000000000000001e6e9cce665ff56b17524171062fc179589b80ce0af21114d99e9c4d923a753064222103710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec7740a501f2380cedbac45c09f234659bf3178290cb689fd61473379cd4e96c50b659c86b1e0abea4b18a72b530ffa29f15a0f803c2853858de28e050956fa849888dffffffff204e0000000000000060f56427d51ee7eee0df7ca2e12c0e64230b01f40975dea6d3c55a4167c83f1d64222103710436c0047bfdc6e148f22633527be74b3da6b2e926721f8475b56cfba9ec7740a501f2380cedbac45c09f234659bf3178290cb689fd61473379cd4e96c50b659c86b1e0abea4b18a72b530ffa29f15a0f803c2853858de28e050956fa849888dffffffff102700000000000001012756010000000000170051147a47c1bd9d669e8e065f18cf85f4ec20389e782500000000',
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
      'dbe0b176c8f425321302aa42d144544f3a7701d07d1666c0a90a642e0351b22a6e687b2c08030415c714843111bac0cfe6ba5e5aac4acb166caee9ae35e12dba',
    );
  });

  it('Nexa Utils Sgin Transaction With signatureBuffer', () => {
    const privateKey =
      '91632aaa4de97d24c58ff234aa371c7a7c8363808a73fa9189cb5ee3d55a0cd3';
    const signatureBuffer =
      '0094d3de9aa564a4fa760a6b16c76a0a15b724c38b39a7249215e397ed1bbf07d40084af2da0940d66153580ce18b185ac78ca4237d3ccaec3dfb32f4fd4134fb63bb13029ce7b1f559ef5e747fcac439f1455a2ec7c5f09b72290795e70665044026cad7049e07c205ae2c4f11bae23b1ead0de47bd52031fdc875e74b590e784c9228a0000000000';
    const digest = sha256sha256(Buffer.from(signatureBuffer, 'hex'));
    expect(digest.toString('hex')).toBe(
      'fe1717e9f1d1315ab2a6048fcb51231f56a88512d1ed1ce552045bf7a9225b4d',
    );
    expect(sign(Buffer.from(privateKey, 'hex'), digest).toString('hex')).toBe(
      '7e5edff03500cec509bf55c4983560de8f794a88ae3539f7804cf2c34cad39d73ef115cf8d8cfa25ec841b38c123c19740a971a7de188319eaac5c4db897ce51',
    );
  });

  it('Nexa verify test', () => {
    expect(
      verify(
        Buffer.from(
          new Uint8Array([
            0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0,
            0x62, 0x95, 0xce, 0x87, 0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d,
            0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16, 0xf8, 0x17, 0x98,
          ]),
        ),
        Buffer.from(
          new Uint8Array([
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
        Buffer.from(
          new Uint8Array([
            0x78, 0x7a, 0x84, 0x8e, 0x71, 0x04, 0x3d, 0x28, 0x0c, 0x50, 0x47,
            0x0e, 0x8e, 0x15, 0x32, 0xb2, 0xdd, 0x5d, 0x20, 0xee, 0x91, 0x2a,
            0x45, 0xdb, 0xdd, 0x2b, 0xd1, 0xdf, 0xbf, 0x18, 0x7e, 0xf6, 0x70,
            0x31, 0xa9, 0x88, 0x31, 0x85, 0x9d, 0xc3, 0x4d, 0xff, 0xee, 0xdd,
            0xa8, 0x68, 0x31, 0x84, 0x2c, 0xcd, 0x00, 0x79, 0xe1, 0xf9, 0x2a,
            0xf1, 0x77, 0xf7, 0xf2, 0x2c, 0xc1, 0xdc, 0xed, 0x05,
          ]),
        ),
      ),
    ).toBeTruthy();

    expect(
      verify(
        Buffer.from(
          new Uint8Array([
            0x03, 0xde, 0xfd, 0xea, 0x4c, 0xdb, 0x67, 0x77, 0x50, 0xa4, 0x20,
            0xfe, 0xe8, 0x07, 0xea, 0xcf, 0x21, 0xeb, 0x98, 0x98, 0xae, 0x79,
            0xb9, 0x76, 0x87, 0x66, 0xe4, 0xfa, 0xa0, 0x4a, 0x2d, 0x4a, 0x34,
          ]),
        ),
        Buffer.from(
          new Uint8Array([
            0x4d, 0xf3, 0xc3, 0xf6, 0x8f, 0xcc, 0x83, 0xb2, 0x7e, 0x9d, 0x42,
            0xc9, 0x04, 0x31, 0xa7, 0x24, 0x99, 0xf1, 0x78, 0x75, 0xc8, 0x1a,
            0x59, 0x9b, 0x56, 0x6c, 0x98, 0x89, 0xb9, 0x69, 0x67, 0x03,
          ]),
        ),
        Buffer.from(
          new Uint8Array([
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x3b, 0x78, 0xce, 0x56, 0x3f, 0x89, 0xa0, 0xed, 0x94, 0x14, 0xf5,
            0xaa, 0x28, 0xad, 0x0d, 0x96, 0xd6, 0x79, 0x5f, 0x9c, 0x63, 0x02,
            0xa8, 0xdc, 0x32, 0xe6, 0x4e, 0x86, 0xa3, 0x33, 0xf2, 0x0e, 0xf5,
            0x6e, 0xac, 0x9b, 0xa3, 0x0b, 0x72, 0x46, 0xd6, 0xd2, 0x5e, 0x22,
            0xad, 0xb8, 0xc6, 0xbe, 0x1a, 0xeb, 0x08, 0xd4, 0x9d,
          ]),
        ),
      ),
    ).toBeTruthy();
  });

  it('Nexa buildDecodeTxFromTx test', () => {
    expect(true).toBeFalsy();
  }); 
});

export {};
