import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  COINTYPE_NEO,
  IMPL_NEO,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import { NEO_GAS_TOKEN_ADDRESS } from './sdkNeo/constant';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'NEO',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_NEO}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_NEO,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_NEO,
  coinTypeDefault: COINTYPE_NEO,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  softwareAccountDisabled: true,

  supportedDeviceTypes: [
    EDeviceType.Classic1s,
    EDeviceType.Pro,
    EDeviceType.ClassicPure,
  ],

  defaultFeePresetIndex: 1,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  customRpcEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
      nativeTokenAddress: NEO_GAS_TOKEN_ADDRESS,
    },
  },
};

export default Object.freeze(settings);
