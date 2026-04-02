import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  COINTYPE_STELLAR,
  IMPL_STELLAR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'XLM',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_STELLAR}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_STELLAR,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_STELLAR,
  coinTypeDefault: COINTYPE_STELLAR,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: true,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [ECoreApiExportedSecretKeyType.privateKey],

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,
  activateTokenRequired: true, // Stellar needs to establish a trustline to receive tokens.
  hasFrozenBalance: true, // trustline count * 0.5XLM is frozen balance

  withMemo: true,
  supportMemoValidation: true, // Use Vault.validateMemo() for precise validation

  accountDeriveInfo,
  customRpcEnabled: true,
  preCheckDappTxFeeInfoRequired: true,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
      nativeTokenAddress: '',
    },
  },
};

export default Object.freeze(settings);
