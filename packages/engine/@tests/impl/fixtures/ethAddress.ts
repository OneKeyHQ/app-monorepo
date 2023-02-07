import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { getAccountNameInfoByImpl } from '../../../src/managers/impl';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

const ethAccountNameInfo = getAccountNameInfoByImpl(IMPL_EVM);

const mnemonic =
  'ridge connect analyst barrel apology bracket steak drastic naive basket silver term';

const fixtures: {
  description: string;
  params: {
    prepareAccountParams: IPrepareSoftwareAccountsParams;
    mnemonic: string;
  };
  response: string[];
  error?: string;
}[] = [
  {
    description:
      'should genereate BIP44 standard addresses on ethereum network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: ethAccountNameInfo.default.coinType,
        template: ethAccountNameInfo.default.template,
      },
      mnemonic,
    },
    response: [
      '0xA09E570CF345dB5bF542FE1b7AC2424fB28AEA32',
      '0x19Bfb53470b398A2e6Eb91e35C5351a2a8516eF8',
      '0x41CD94F449903421d6b6707C24149BF8f1CBbBBa',
      '0xf0b884D2EE778C7E8b34753C4175E3969fe80c4e',
      '0x7B68eC9dc3e85154015657d4195D50FcAF3adf78',
      '0x2f122d90F59D1FB7614B8410633849c7B2E2bBe5',
      '0x3F9b1c0585bAe0ca8D0cC725897715e47232B49E',
      '0x68c7824f23B3548D33352606CbAA88cB3d8D7f9A',
      '0x128cf9F357E2E4C549CA22de38b7DA15599dd8A3',
      '0xA315B189f710C5D3666E9571e714E6ffF1F7173e',
    ],
    error: 'Genereate ethereum address failed',
  },
  {
    description: 'should genereate Ledger Live addresses on ethereum network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: ethAccountNameInfo.ledgerLive.coinType,
        template: ethAccountNameInfo.ledgerLive.template,
      },
      mnemonic,
    },
    response: [
      '0xA09E570CF345dB5bF542FE1b7AC2424fB28AEA32',
      '0x3c87f354E93Af66e22D3b85bCB6CeefA572D3ebd',
      '0x35e74736CaE1D6F8A52304d5F78554008205D3D2',
      '0x1fFAba8693bd2Bec85a419f2a52b8935F92e2529',
      '0x679E4FC542fD2DF2F760C7d12CdA7A30B00Fde89',
      '0x734CD3d73C2D2f9Dc50D172B35D20Ca6E39B96dD',
      '0x5c01B10c4ab37bDEE9699125aE4e0E3a1ed1572e',
      '0x4fE900200ccEB4020FB7FE8C3EaFB70E5179F1AD',
      '0x2804BF30517dE3E40f1FC68EE0A7dD91040C70b8',
      '0xD0c401d5716b919e8dA9ae2fE8E8bE7be8d31391',
    ],
    error: 'Genereate ethereum address failed',
  },
  {
    description: 'should genereate Ledger Legacy addresses on ethereum network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: ethAccountNameInfo.ledgerLegacy.coinType,
        template: ethAccountNameInfo.ledgerLegacy.template,
      },
      mnemonic,
    },
    response: [
      '0x4289f1a819203db16E11a7A5Bfbc1E2293Ac540f',
      '0x717270C18821196F512537b5308667a380fd23A6',
      '0xF7dD475F39312bB8a81A61DD364b78FAC48FcB56',
      '0x5ce386C4592e7becE579296fbaca16EBFff6A85A',
      '0x0e7359d4eBE202C678f2DB0e7D4673C7B7bc5204',
      '0x773e206c9C0d3b43A1906f1BC7dBef390e79BB1E',
      '0x2524698f82285E49fb11aCD1a98BeB834a20D447',
      '0x11AD110A927B889f7081121640766669e2b3A649',
      '0x0A1676e6A89C821caeA9a4853D0b55e0f0dA6D13',
      '0x6f9135d82961E50015ACf7bF2Cf0910bc8cb4024',
    ],
    error: 'Genereate ethereum address failed',
  },
];

export default fixtures;
