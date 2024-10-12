import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EMPTY_NATIVE_TOKEN_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import {
  COINTYPE_SOL,
  IMPL_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapSol = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  ledgerLive: IAccountDeriveInfo;
};

const accountDeriveInfo: IAccountDeriveInfoMapSol = {
  default: {
    namePrefix: 'SOL',
    template: `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_SOL,
    labelKey: ETranslations.bip44__standard,
    desc: `OneKey, Phantom, Sollet, m/44'/501'/*'/0'`,
  },
  ledgerLive: {
    namePrefix: 'SOL Ledger Live',
    template: `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_SOL,
    label: 'Ledger Live',
    desc: `Ledger Live, Solflare, m/44'/501'/*'`,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_SOL,
  coinTypeDefault: COINTYPE_SOL,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  dappInteractionEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 6,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
  hasFrozenBalance: true,

  preCheckDappTxFeeInfoRequired: true,
  customRpcEnabled: true,

  sendZeroWithZeroTokenBalanceDisabled: true,

  stakingConfig: {
    [getNetworkIdsMap().sol]: {
      providers: {
        [EEarnProviderEnum.Everstake]: {
          supportedSymbols: ['SOL'],
          configs: {
            'SOL': {
              enabled: true,
              tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
              displayProfit: true,
              withdrawWithTx: true,
              claimWithTx: true,
            },
          },
        },
      },
    },
  },
};

export default Object.freeze(settings);
