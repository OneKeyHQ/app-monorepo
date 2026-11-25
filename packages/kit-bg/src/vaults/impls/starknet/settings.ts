import { EDeviceType } from '@onekeyfe/hd-shared';

import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  COINTYPE_STARKNET,
  IMPL_STARKNET,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { EDBAccountType } from '../../../dbs/local/consts';

import { STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapStarknet = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  starknetOpenZeppelin: IAccountDeriveInfo;
};
export type IAccountDeriveTypesStarknet = keyof IAccountDeriveInfoMapStarknet;

/**
 * All entries use the Argent X path; the account contract (and, for HD, how
 * the key is derived) tells them apart, hence the id suffix. The secp256k1
 * child key is ground into the Stark curve order inside the core module, so
 * `curve` below stays secp256k1.
 */
const accountDeriveInfo: IAccountDeriveInfoMapStarknet = {
  default: {
    namePrefix: 'STRK',
    label: 'Argent',
    template: `m/44'/${COINTYPE_STARKNET}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_STARKNET,
    desc: 'Argent X / Ready account',
    useAddressEncodingDerive: true,
  },
  starknetOpenZeppelin: {
    namePrefix: 'STRK OpenZeppelin',
    label: 'OpenZeppelin',
    template: `m/44'/${COINTYPE_STARKNET}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_STARKNET,
    addressEncoding: EAddressEncodings.STARKNET_OZ,
    idSuffix: EAddressEncodings.STARKNET_OZ,
    desc: 'OpenZeppelin account',
    useAddressEncodingDerive: true,
  },
  // Keep OKX account creation disabled until firmware supports the proxy.
  // starknetOkx: {
  //   namePrefix: 'STRK OKX',
  //   label: 'OKX',
  //   template: `m/44'/${COINTYPE_STARKNET}'/0'/0/${INDEX_PLACEHOLDER}`,
  //   coinType: COINTYPE_STARKNET,
  //   addressEncoding: EAddressEncodings.STARKNET_OKX,
  //   idSuffix: EAddressEncodings.STARKNET_OKX,
  //   desc: 'OKX Wallet account',
  //   useAddressEncodingDerive: true,
  // },
};

const settings: IVaultSettings & {
  accountDeriveInfo: IAccountDeriveInfoMapStarknet;
} = {
  impl: IMPL_STARKNET,
  coinTypeDefault: COINTYPE_STARKNET,
  accountType: EDBAccountType.SIMPLE,
  accountDeriveMode: 'walletContract',

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,
  supportedDeviceTypes: [EDeviceType.Pro2],

  supportExportedSecretKeys: [ECoreApiExportedSecretKeyType.privateKey],

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,
  prepareSendConfirmation: true,
  supportBatchEstimateFee: {
    'starknet--mainnet': 'local',
    'starknet--sepolia': 'local',
  },

  // STRK20 shielded pool. Runtime availability also checks the server switch
  // (serviceStarknetPrivacy.isPrivacyAvailable); this descriptor only says the
  // chain has the feature at all.
  privacyPool: {
    // The sequencer only accepts a proof whose base block is >=10 blocks old.
    sequencingCooldownBlocks: 10,
  },

  accountDeriveInfo,
  customRpcEnabled: true,

  // STRK is a real ERC-20, so the native entry carries its contract address and
  // the add-custom-token form keeps its contract field.
  isNativeTokenContractAddressEmpty: false,

  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
      nativeTokenAddress: STRK_TOKEN_ADDRESS,
    },
  },
};

export default Object.freeze(settings);
