import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_LTC,
  IMPL_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { getAccountNameInfoByImpl } from '../../src/managers/impl';

const evmAccountInfo = getAccountNameInfoByImpl(IMPL_EVM);
const solAccountInfo = getAccountNameInfoByImpl(IMPL_SOL);
const btcAccountInfo = getAccountNameInfoByImpl(IMPL_BTC);
const ltcAccountInfo = getAccountNameInfoByImpl(IMPL_LTC);

export default [
  {
    description: 'ethereum account 1',
    params: {
      'id': "hd-2--m/44'/60'/0'/0/0",
      'name': 'EVM #1',
      'type': 'simple',
      'path': "m/44'/60'/0'/0/0",
      'coinType': '60',
      'pub':
        '022917105016da6690fa8c605e28f7a8944493888be76c51747a17c90eaf94fa79',
      'address': '0xa09e570cf345db5bf542fe1b7ac2424fb28aea32',
    },
    response: evmAccountInfo.default.template,
  },
  {
    description: 'ethereum account 2',
    params: {
      'id': "hd-2--m/44'/60'/0'/0/2",
      'name': 'EVM #3',
      'type': 'simple',
      'path': "m/44'/60'/0'/0/2",
      'coinType': '60',
      'pub':
        '02c101dafbceb365baaf9df2d7792f131ec79b1d768b540957112bbeeebb536813',
      'address': '0x41cd94f449903421d6b6707c24149bf8f1cbbbba',
      'template': `m/44'/60'/0'/0/${INDEX_PLACEHOLDER}`,
    },
    response: evmAccountInfo.default.template,
  },
  {
    description: 'SOLANA account 1',
    params: {
      'id': "hd-2--m/44'/501'/0'/0'",
      'name': 'SOL #1',
      'type': 'simple',
      'path': "m/44'/501'/0'/0'",
      'coinType': '501',
      'pub': 'EPd2tKSywSyAvH2rSYmrK6MyRB4FN1x1DwRzUGMX9BDb',
      'address': 'EPd2tKSywSyAvH2rSYmrK6MyRB4FN1x1DwRzUGMX9BDb',
    },
    response: solAccountInfo.default.template,
  },
  {
    description: 'BTC legacy acount',
    params: {
      address: '1LWNvonGKJcqJry6S3HJsRPDXHb3axusbT',
      coinType: '0',
      id: "hd-2--m/44'/0'/0'",
      name: 'BTC Legacy #1',
      path: "m/44'/0'/0'",
    },
    response: btcAccountInfo.BIP44.template,
  },
  {
    description: 'BTC Nested SegWit acount',
    params: {
      address: '3J7vTY4f1TECF5Ck16d4Rf7v6qDZ8HjY3M',
      coinType: '0',
      id: "hd-2--m/49'/0'/0'",
      name: 'BTC Nested SegWit #1',
      path: "m/49'/0'/0'",
    },
    response: btcAccountInfo.default.template,
  },
  {
    description: 'BTC Native SegWit acount',
    params: {
      address: 'bc1qcrunzx2aj9d2gg72wk3rvfsy80tjq9gqs5z2f7',
      coinType: '0',
      id: "hd-2--m/84'/0'/0'",
      name: 'BTC Native SegWit #1',
      path: "m/84'/0'/0'",
    },
    response: btcAccountInfo.BIP84.template,
  },
  {
    description: 'LTC Nested SegWit acount',
    params: {
      address: 'MQSP2NKBrWNY7rs9PsTSozJxyKdyQsJmHu',
      coinType: '2',
      id: "hd-2--m/49'/2'/0'",
      name: 'BTC Nested SegWit #1',
      path: "m/49'/2'/0'",
    },
    response: ltcAccountInfo.default.template,
  },
  {
    description: 'LTC Native SegWit acount',
    params: {
      address: 'bc1qcrunzx2aj9d2gg72wk3rvfsy80tjq9gqs5z2f7',
      coinType: '2',
      id: "hd-2--m/84'/2'/0'",
      name: 'LTC Native SegWit #1',
      path: "m/84'/2'/0'",
    },
    response: ltcAccountInfo.BIP84.template,
  },
];
