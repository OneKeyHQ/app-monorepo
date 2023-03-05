import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { getAccountNameInfoByImpl } from '../../../src/managers/impl';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

const solAccountNameInfo = getAccountNameInfoByImpl(IMPL_SOL);

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
    description: 'should genereate BIP44 standard addresses on SOLANA network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: solAccountNameInfo.default.coinType,
        template: solAccountNameInfo.default.template,
      },
      mnemonic,
    },
    response: [
      'EPd2tKSywSyAvH2rSYmrK6MyRB4FN1x1DwRzUGMX9BDb',
      '5JESP5kEXCqg39mtTxyd78mYtitoCZgJ61EHVhGLtCwg',
      '43dt9qv6VhAyefdgJMJwxVCN93jiKayiZBd89bxd87zN',
      'FAgAeSQwAHz27VP5dFg7Vk3NLNUn97hVHzsam3Lc2oi5',
      '6Wg5VHU2oSerp2ZkdRrAjStraVPp86vQezhuLtHBnyR4',
      'VuxkbQMQ2WbdX4xkNZqLv3b23XCmtd8588AUFHykXTk',
      '9gkT3f18dj5mP2oX6kw1XDRJwvTD28dkjfDUzvakmWB2',
      '5UdfFi4BsauGcyrFo6jfGzQxH2pd9DS6WqFrNyFsgQGY',
      'EoaAXL6SLpPThy2rjN74ZgrLviY15NrhjdTEQwHRVcre',
      'HWZtxffbpC7YvD2ednM91jokwJKX515E69YXjQbxYCyM',
    ],
    error: 'Genereate ethereum address failed',
  },
  {
    description: 'should genereate Ledger Live addresses on SOLANA network',
    params: {
      prepareAccountParams: {
        password: '',
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        coinType: solAccountNameInfo.ledgerLive.coinType,
        template: solAccountNameInfo.ledgerLive.template,
      },
      mnemonic,
    },
    response: [
      'DFUjffkFJZEd6Jyp3Vve5A5rHgvwp3Ubz6WRUKEvXgw5',
      '8xUK6hND1pNbW9gfUwKbXgrdRxqMSmCpmXev2jn3AhsH',
      '3SrmnrZRJFHfdHkFaa4pJWc7reTjL465CWFGHDqwTZj1',
      'B3Z153jC1SCGuPXRhPAqpGrugPYCmxQpX1jMzt1KfubQ',
      '8xwBiZFBkLUrmQ2W9GCr5PWWGzoLpt8pFe9DspDG71AF',
      '4iJSGooWZ1dbvaJC8GFAd17pmGUh8by3EfnGFDt5eegd',
      '3CC6NC56y5Mnv62TmwrcpXpiUbpGkahtL4cPghAXdifE',
      'A3jja6fDAVw4XxsKx6ABShghA3ZaK6oHi5M5qt5Vbbys',
      '2JJiYsYHCqN6FvgwDzXwnChZzBuSzywqNhNmbT7x1Q7G',
      'FUBiKYmYFyT69X27bFpuNzGnWm7Vh1mF5chaimFJLfmM',
    ],
    error: 'Genereate ethereum address failed',
  },
];

export default fixtures;
