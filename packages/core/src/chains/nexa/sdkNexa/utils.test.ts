import { sign, verify } from '@onekeyhq/core/src/chains/nexa/sdkNexa/sdk';

import {
  decodeScriptBufferToNexaAddress,
  sha256sha256,
  signEncodedTx,
} from './utils';

import type { ChainSigner } from '../../../base/ChainSigner';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa Utils Tests', () => {
  it('Nexa Utils signEncodedTx #1', async () => {
    const signedTx = await signEncodedTx(
      {
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
          // 'transferInfo': {
          //   'from': 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
          //   'to': 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
          //   'amount': '50',
          // },
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
      } as unknown as ChainSigner,
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
          // 'transferInfo': {
          //   'from': 'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
          //   'to': 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
          //   'amount': '50',
          // },
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
      } as unknown as ChainSigner,
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
          // 'transferInfo': {
          //   'from': 'nexatest:nqtsq5g5skxwlgtmsl99hj6tt8hmsa52cxft09um2md36p07',
          //   'to': 'nexatest:nqtsq5g50frur0vav60gupjlrr8cta8vyqufu7p9gskt92mz',
          //   'amount': '900',
          // },
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
      } as unknown as ChainSigner,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testData0 = {
      'tx': {
        'blockhash':
          '883d9ab547bd3627671589481f741531cf0f4a5c3365305d97a4408ff5678b28',
        'blocktime': 1690620568,
        'confirmations': 10,
        'fee': 6.57,
        'fee_satoshi': 657,
        'hash':
          '83733a87c75cd486f5de6232eb79544f8cd186f4cdc8dc7b05291bde3a078a54',
        'height': 327692,
        'hex':
          '000100f65e88bbae07d0a1f62903d7ac3711824861c741bccc6d46cdbb9ddf0e2618de64222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40d3bfe5850c05b225c93e5312eb52025b59074cad775a43e061ae87a89e7e78c8b8fc6e279bbe09bcf1fc9675881c6f647d61be99d5fc922a51303dae9203178affffffffd1800000000000000101407e000000000000170051147cf62b8a1314b059e25d06a441e02dac445d287200000000',
        'locktime': 0,
        'size': 186,
        'time': 1690620568,
        'txid':
          '83733a87c75cd486f5de6232eb79544f8cd186f4cdc8dc7b05291bde3a078a54',
        'txidem':
          '1c7387541400b5ce1965c8c5b831405be8b6cb0c85f263b1cfd6061256a4bb83',
        'version': 0,
        'vin': [
          {
            'coinbase': null,
            'outpoint':
              'de18260edf9dbbcd466dccbc41c76148821137acd70329f6a1d007aebb885ef6',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 2103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd OP_PUSHBYTES_64 d3bfe5850c05b225c93e5312eb52025b59074cad775a43e061ae87a89e7e78c8b8fc6e279bbe09bcf1fc9675881c6f647d61be99d5fc922a51303dae9203178a',
              'hex':
                '222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40d3bfe5850c05b225c93e5312eb52025b59074cad775a43e061ae87a89e7e78c8b8fc6e279bbe09bcf1fc9675881c6f647d61be99d5fc922a51303dae9203178a',
            },
            'sequence': 4294967295,
            'value': 329.77,
            'value_coin': 329.77,
            'value_satoshi': 32977,
          },
        ],
        'vout': [
          {
            'n': 0,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '7cf62b8a1314b059e25d06a441e02dac445d2872',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 7cf62b8a1314b059e25d06a441e02dac445d2872',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '0051147cf62b8a1314b059e25d06a441e02dac445d2872',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 323.2,
            'value_coin': 323.2,
            'value_satoshi': 32320,
          },
        ],
      },
      'dbAccountAddress':
        'nexa:nqtsq5g50nmzhzsnzjc9ncjaq6jyrcpd43z962rjffhrvpe0',
      'addressPrefix': 'nexa',
      'decimals': 2,
      'token': {
        'id': 'nexa--0',
        'name': 'NEX',
        'networkId': 'nexa--0',
        'tokenIdOnNetwork': '',
        'symbol': 'NEX',
        'decimals': 2,
        'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
        'impl': 'nexa',
        'chainId': '0',
        'address': '',
        'source': '',
        'isNative': true,
      },
      'networkId': 'nexa--0',
      'accountId': "hd-1--m/44'/29223'/0'",
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testData1 = {
      'tx': {
        'blockhash':
          'f45fb9167e49411aca54817b2e45399e91795553204742015ddfafb59c3f062f',
        'blocktime': 1690620486,
        'confirmations': 11,
        'fee': 10.95,
        'fee_satoshi': 1095,
        'hash':
          'e3bb34578c69d7d705b9fe054a4acb76c59d1026d719fd37520564dd28c0d22f',
        'height': 327691,
        'hex':
          '00020004e5fac31a92877fa08a8d7d9847b6864128a8e927a96645b5a24fd63a7c67e464222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8ffffffff220200000000000000875cded686fe492a6636c99e1b5a9df8c3ec7264926391f7d0d898dad2b7c06764222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8ffffffffa98700000000000002012202000000000000170051147cf62b8a1314b059e25d06a441e02dac445d287201628300000000000017005114375f5e5be9ddf719d8635306663c7903b530dbab00000000',
        'locktime': 0,
        'size': 365,
        'time': 1690620486,
        'txid':
          'e3bb34578c69d7d705b9fe054a4acb76c59d1026d719fd37520564dd28c0d22f',
        'txidem':
          '78fb104762a67eaea9092806e6c9c723058bc3a5ed4641630ea6d87c1ef7b326',
        'version': 0,
        'vin': [
          {
            'coinbase': null,
            'outpoint':
              'e4677c3ad64fa2b54566a927e9a8284186b647987d8d8aa07f87921ac3fae504',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 2103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd OP_PUSHBYTES_64 c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8',
              'hex':
                '222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8',
            },
            'sequence': 4294967295,
            'value': 5.46,
            'value_coin': 5.46,
            'value_satoshi': 546,
          },
          {
            'coinbase': null,
            'outpoint':
              '67c0b7d2da98d8d0f79163926472ecc3f89d5a1b9ec936662a49fe86d6de5c87',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 2103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd OP_PUSHBYTES_64 c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8',
              'hex':
                '222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd40c447c903813548077c52ae6db55f208ec000dbf25d12e1f39a6ebbe42a2fe5069146e0230928ad521c0ec827a75ad7afd560a4ef5a9db855e2b61c1f859a7ec8',
            },
            'sequence': 4294967295,
            'value': 347.29,
            'value_coin': 347.29,
            'value_satoshi': 34729,
          },
        ],
        'vout': [
          {
            'n': 0,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '7cf62b8a1314b059e25d06a441e02dac445d2872',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 7cf62b8a1314b059e25d06a441e02dac445d2872',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '0051147cf62b8a1314b059e25d06a441e02dac445d2872',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 5.46,
            'value_coin': 5.46,
            'value_satoshi': 546,
          },
          {
            'n': 1,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '375f5e5be9ddf719d8635306663c7903b530dbab',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 375f5e5be9ddf719d8635306663c7903b530dbab',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '005114375f5e5be9ddf719d8635306663c7903b530dbab',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 336.34,
            'value_coin': 336.34,
            'value_satoshi': 33634,
          },
        ],
      },
      'dbAccountAddress':
        'nexa:nqtsq5g50nmzhzsnzjc9ncjaq6jyrcpd43z962rjffhrvpe0',
      'addressPrefix': 'nexa',
      'decimals': 2,
      'token': {
        'id': 'nexa--0',
        'name': 'NEX',
        'networkId': 'nexa--0',
        'tokenIdOnNetwork': '',
        'symbol': 'NEX',
        'decimals': 2,
        'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
        'impl': 'nexa',
        'chainId': '0',
        'address': '',
        'source': '',
        'isNative': true,
      },
      'networkId': 'nexa--0',
      'accountId': "hd-1--m/44'/29223'/0'",
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testData2 = {
      'tx': {
        'blockhash':
          '9d091abed6ca67fbd37afeb358d8e1a80eb97d8a018dc0b5cd9f6b9c0317e5f1',
        'blocktime': 1690527851,
        'confirmations': 786,
        'fee': 6.57,
        'fee_satoshi': 657,
        'hash':
          '527224633117cd391a361b1781a8693ddf0bfa8cd5cd3e74f82501cb359c0339',
        'height': 326916,
        'hex':
          '000100146071316651d85607ea31ba13bb7122a4de2e4b9f4db037827e4b9294f2de766422210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d9024067415afb814e05bc8c54f27bbccddd784ff9b3d3512c981a0aa0c5d0eae184ceb4c1092810242e3b4088aadab05ba9b6e0ade3dfdd04b6ccb4426a481c21c905ffffffff0e556905000000000201204e00000000000017005114ee199ed68abcda4139c8439527080f3a6aee3bf2015d04690500000000170051147cf62b8a1314b059e25d06a441e02dac445d287200000000',
        'locktime': 0,
        'size': 219,
        'time': 1690527851,
        'txid':
          '527224633117cd391a361b1781a8693ddf0bfa8cd5cd3e74f82501cb359c0339',
        'txidem':
          '506d9a442a7c725a152c73e1328cf8a157db89070543728e200b46e3c3b4e2a6',
        'version': 0,
        'vin': [
          {
            'coinbase': null,
            'outpoint':
              '76def294924b7e8237b04d9f4b2edea42271bb13ba31ea0756d8516631716014',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d902 OP_PUSHBYTES_64 67415afb814e05bc8c54f27bbccddd784ff9b3d3512c981a0aa0c5d0eae184ceb4c1092810242e3b4088aadab05ba9b6e0ade3dfdd04b6ccb4426a481c21c905',
              'hex':
                '22210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d9024067415afb814e05bc8c54f27bbccddd784ff9b3d3512c981a0aa0c5d0eae184ceb4c1092810242e3b4088aadab05ba9b6e0ade3dfdd04b6ccb4426a481c21c905',
            },
            'sequence': 4294967295,
            'value': 907891.34,
            'value_coin': 907891.34,
            'value_satoshi': 90789134,
          },
        ],
        'vout': [
          {
            'n': 0,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': 'ee199ed68abcda4139c8439527080f3a6aee3bf2',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 ee199ed68abcda4139c8439527080f3a6aee3bf2',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '005114ee199ed68abcda4139c8439527080f3a6aee3bf2',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 200,
            'value_coin': 200,
            'value_satoshi': 20000,
          },
          {
            'n': 1,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '7cf62b8a1314b059e25d06a441e02dac445d2872',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 7cf62b8a1314b059e25d06a441e02dac445d2872',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '0051147cf62b8a1314b059e25d06a441e02dac445d2872',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 907684.77,
            'value_coin': 907684.77,
            'value_satoshi': 90768477,
          },
        ],
      },
      'dbAccountAddress':
        'nexa:nqtsq5g50nmzhzsnzjc9ncjaq6jyrcpd43z962rjffhrvpe0',
      'addressPrefix': 'nexa',
      'decimals': 2,
      'token': {
        'id': 'nexa--0',
        'name': 'NEX',
        'networkId': 'nexa--0',
        'tokenIdOnNetwork': '',
        'symbol': 'NEX',
        'decimals': 2,
        'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
        'impl': 'nexa',
        'chainId': '0',
        'address': '',
        'source': '',
        'isNative': true,
      },
      'networkId': 'nexa--0',
      'accountId': "hd-1--m/44'/29223'/0'",
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testData3 = {
      'tx': {
        'blockhash':
          'f45fb9167e49411aca54817b2e45399e91795553204742015ddfafb59c3f062f',
        'blocktime': 1690620486,
        'confirmations': 25,
        'fee': 6.57,
        'fee_satoshi': 657,
        'hash':
          'cfd56e4702dc445e1150c144ce1c0ff91aaedb2d3ec580d3c50df7d8bc6c0fbc',
        'height': 327691,
        'hex':
          '0001000e2acf067dae90dfa42bba210f53f9956ad9ba2f62959be1b26daf97e6d220cb64222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd408f88d1555f0ae0036eba870a7e966c98934dcfde60f571184ca560d8f2dae18ad0ef95e3f927da5fbf7ceba672f99d1d4380a078316556b0e04541d64b052bfcffffffff62830000000000000101d18000000000000017005114375f5e5be9ddf719d8635306663c7903b530dbab00000000',
        'locktime': 0,
        'size': 186,
        'time': 1690620486,
        'txid':
          'cfd56e4702dc445e1150c144ce1c0ff91aaedb2d3ec580d3c50df7d8bc6c0fbc',
        'txidem':
          '3fe1e04cf624e06d11e6849acd3f6c028d3764f526e57235821d9b23f483fd98',
        'version': 0,
        'vin': [
          {
            'coinbase': null,
            'outpoint':
              'cb20d2e697af6db2e19b95622fbad96a95f9530f21ba2ba4df90ae7d06cf2a0e',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 2103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd OP_PUSHBYTES_64 8f88d1555f0ae0036eba870a7e966c98934dcfde60f571184ca560d8f2dae18ad0ef95e3f927da5fbf7ceba672f99d1d4380a078316556b0e04541d64b052bfc',
              'hex':
                '222103d1becb4798abb1d016be6889cbb0ba0b19c9f1d5e07961779c089af3c63984bd408f88d1555f0ae0036eba870a7e966c98934dcfde60f571184ca560d8f2dae18ad0ef95e3f927da5fbf7ceba672f99d1d4380a078316556b0e04541d64b052bfc',
            },
            'sequence': 4294967295,
            'value': 336.34,
            'value_coin': 336.34,
            'value_satoshi': 33634,
          },
        ],
        'vout': [
          {
            'n': 0,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '375f5e5be9ddf719d8635306663c7903b530dbab',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 375f5e5be9ddf719d8635306663c7903b530dbab',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '005114375f5e5be9ddf719d8635306663c7903b530dbab',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 329.77,
            'value_coin': 329.77,
            'value_satoshi': 32977,
          },
        ],
      },
      'dbAccountAddress':
        'nexa:nqtsq5g5xa04uklfmhm3nkrr2vrxv0reqw6npkatl7dx7fjz',
      'addressPrefix': 'nexa',
      'decimals': 2,
      'token': {
        'id': 'nexa--0',
        'name': 'NEX',
        'networkId': 'nexa--0',
        'tokenIdOnNetwork': '',
        'symbol': 'NEX',
        'decimals': 2,
        'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
        'impl': 'nexa',
        'chainId': '0',
        'address': '',
        'source': '',
        'isNative': true,
      },
      'networkId': 'nexa--0',
      'accountId': "hd-1--m/44'/29223'/1'",
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testData4 = {
      'tx': {
        'blockhash':
          'ef5c6db9a60f12476e3158753dc46477a8615bee32b11e9aa2223a15b6366647',
        'blocktime': 1690440535,
        'confirmations': 1541,
        'fee': 6.57,
        'fee_satoshi': 657,
        'hash':
          'ec435f39d0d2ad77e0a0046c26d9586deeb185e2b7e7146275ac7a5951939d7b',
        'height': 326194,
        'hex':
          '00010034aefaf89ad98e8029c6f5f0984dd3f26f3b6a47a4873d94044e51bb937fb7ae6422210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d90240431834e9f5de207aab26ddba0cd0945a8bf61e848fcb737553d43455eb3000981315c844660575286be056e4b4b1cad2d2f377ee134d132433e872d45000de4dffffffff78c36905000000000201e80300000000000017005114375f5e5be9ddf719d8635306663c7903b530dbab01ffbc690500000000170051147cf62b8a1314b059e25d06a441e02dac445d287200000000',
        'locktime': 0,
        'size': 219,
        'time': 1690440535,
        'txid':
          'ec435f39d0d2ad77e0a0046c26d9586deeb185e2b7e7146275ac7a5951939d7b',
        'txidem':
          '4439c235e5b63d4eb662d686dfbfa28f9bc6c0922f7f1aecf1b01ffe4225b880',
        'version': 0,
        'vin': [
          {
            'coinbase': null,
            'outpoint':
              'aeb77f93bb514e04943d87a4476a3b6ff2d34d98f0f5c629808ed99af8faae34',
            'scriptSig': {
              'asm':
                'OP_PUSHBYTES_34 210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d902 OP_PUSHBYTES_64 431834e9f5de207aab26ddba0cd0945a8bf61e848fcb737553d43455eb3000981315c844660575286be056e4b4b1cad2d2f377ee134d132433e872d45000de4d',
              'hex':
                '22210340cd9f307400d42887f4e5231a14fa16749290f2775daa6bd7e403e28440d90240431834e9f5de207aab26ddba0cd0945a8bf61e848fcb737553d43455eb3000981315c844660575286be056e4b4b1cad2d2f377ee134d132433e872d45000de4d',
            },
            'sequence': 4294967295,
            'value': 908174,
            'value_coin': 908174,
            'value_satoshi': 90817400,
          },
        ],
        'vout': [
          {
            'n': 0,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '375f5e5be9ddf719d8635306663c7903b530dbab',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 375f5e5be9ddf719d8635306663c7903b530dbab',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '005114375f5e5be9ddf719d8635306663c7903b530dbab',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 10,
            'value_coin': 10,
            'value_satoshi': 1000,
          },
          {
            'n': 1,
            'scriptPubKey': {
              'addresses': [],
              'argsHash': '7cf62b8a1314b059e25d06a441e02dac445d2872',
              'asm':
                'OP_0 OP_PUSHNUM_1 OP_PUSHBYTES_20 7cf62b8a1314b059e25d06a441e02dac445d2872',
              'group': null,
              'groupAuthority': 0,
              'groupQuantity': null,
              'hex': '0051147cf62b8a1314b059e25d06a441e02dac445d2872',
              'scriptHash': 'pay2pubkeytemplate',
              'token_id_hex': null,
              'type': 'scripttemplate',
            },
            'type': 1,
            'value': 908157.43,
            'value_coin': 908157.43,
            'value_satoshi': 90815743,
          },
        ],
      },
      'dbAccountAddress':
        'nexa:nqtsq5g5xa04uklfmhm3nkrr2vrxv0reqw6npkatl7dx7fjz',
      'addressPrefix': 'nexa',
      'decimals': 2,
      'token': {
        'id': 'nexa--0',
        'name': 'NEX',
        'networkId': 'nexa--0',
        'tokenIdOnNetwork': '',
        'symbol': 'NEX',
        'decimals': 2,
        'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
        'impl': 'nexa',
        'chainId': '0',
        'address': '',
        'source': '',
        'isNative': true,
      },
      'networkId': 'nexa--0',
      'accountId': "hd-1--m/44'/29223'/1'",
    };
  });
});

export {};
