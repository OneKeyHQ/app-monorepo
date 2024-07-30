import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINTYPE_TON,
  IMPL_TON,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapTon = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  v3R1: IAccountDeriveInfo;
  v4R1: IAccountDeriveInfo;
  v4R2: IAccountDeriveInfo;
};

const accountDeriveInfo: IAccountDeriveInfoMapTon = {
  v3R1: {
    namePrefix: '',
    label: EAddressEncodings.V3R1,
    template: `m/44'/${COINTYPE_TON}'/0'/0'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_TON,
    addressEncoding: EAddressEncodings.V3R1,
    idSuffix: EAddressEncodings.V3R1,
  },
  default: {
    namePrefix: '',
    label: EAddressEncodings.V3R2,
    template: `m/44'/${COINTYPE_TON}'/0'/0'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_TON,
    addressEncoding: EAddressEncodings.V3R2,
    idSuffix: EAddressEncodings.V3R2,
  },
  v4R1: {
    namePrefix: '',
    label: EAddressEncodings.V4R1,
    template: `m/44'/${COINTYPE_TON}'/0'/0'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_TON,
    addressEncoding: EAddressEncodings.V4R1,
    idSuffix: EAddressEncodings.V4R1,
  },
  v4R2: {
    namePrefix: '',
    label: EAddressEncodings.V4R2,
    template: `m/44'/${COINTYPE_TON}'/0'/0'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_TON,
    addressEncoding: EAddressEncodings.V4R2,
    idSuffix: EAddressEncodings.V4R2,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_TON,
  coinTypeDefault: COINTYPE_TON,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
