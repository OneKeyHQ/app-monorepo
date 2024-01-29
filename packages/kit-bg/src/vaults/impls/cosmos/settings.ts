import {
  COINTYPE_COSMOS,
  IMPL_COSMOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapCosmos = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
};
export type IAccountDeriveTypesCosmos = keyof IAccountDeriveInfoMapCosmos;

const accountDeriveInfo: IAccountDeriveInfoMapCosmos = {
  default: {
    namePrefix: 'COSMOS',
    template: `m/44'/${COINTYPE_COSMOS}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_COSMOS,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_COSMOS,
  coinTypeDefault: COINTYPE_COSMOS,
  accountType: EDBAccountType.VARIANT,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: false,
  NFTEnabled: false,
  nonceRequired: false,
  editFeeEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      addressPrefix: '',
      curve: 'secp256k1',
    },
    'cosmos--cosmoshub-4': {
      'addressPrefix': 'cosmos',
      'curve': 'secp256k1',
      // 'gasPriceStep': {
      //   'min': '0',
      // },
      // 'mainCoinDenom': 'uatom',
    },
    'cosmos--theta-testnet-001': {
      'addressPrefix': 'cosmos',
      'curve': 'secp256k1',
      // 'gasPriceStep': {
      //   'min': '0',
      // },
      // 'mainCoinDenom': 'uatom',
    },
    'cosmos--osmosis-1': {
      'addressPrefix': 'osmo',
      'curve': 'secp256k1',

      // 'gasPriceStep': {
      //   'high': '0.04',
      //   'low': '0.0025',
      //   'min': '0.0025',
      //   'normal': '0.025',
      // },
      // 'mainCoinDenom': 'uosmo',

      // minGasPrice: '0',
      // allowZeroFee: true,
      // isIntegerGasPrice?: boolean;
      // minGasPrice?: string;
      // allowZeroFee?: boolean;
    },
  },
};

export default Object.freeze(settings);
