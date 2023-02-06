import { COINTYPE_ETH } from '@onekeyhq/shared/src/engine/engineConsts';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

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
      'should genereate ten BIP44 standard addresses on ethereum network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: COINTYPE_ETH,
        template: `m/44'/60'/0'/0/x`,
      },
      mnemonic,
    },
    response: [
      '0xa09e570cf345db5bf542fe1b7ac2424fb28aea32',
      '0x19bfb53470b398a2e6eb91e35c5351a2a8516ef8',
      '0x41cd94f449903421d6b6707c24149bf8f1cbbbba',
      '0xf0b884d2ee778c7e8b34753c4175e3969fe80c4e',
      '0x7b68ec9dc3e85154015657d4195d50fcaf3adf78',
      '0x2f122d90f59d1fb7614b8410633849c7b2e2bbe5',
      '0x3f9b1c0585bae0ca8d0cc725897715e47232b49e',
      '0x68c7824f23b3548d33352606cbaa88cb3d8d7f9a',
      '0x128cf9f357e2e4c549ca22de38b7da15599dd8a3',
      '0xa315b189f710c5d3666e9571e714e6fff1f7173e',
    ],
    error: 'Genereate ethereum address failed',
  },
];

export default fixtures;
