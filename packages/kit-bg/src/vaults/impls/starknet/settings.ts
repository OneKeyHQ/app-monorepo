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
  starknetOkx: IAccountDeriveInfo;
  // TEMP(starknet-oz017): remove once funds are off OpenZeppelin v0.17.0 accounts
  starknetOpenZeppelinV017: IAccountDeriveInfo;
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
  starknetOkx: {
    namePrefix: 'STRK OKX',
    label: 'OKX',
    template: `m/44'/${COINTYPE_STARKNET}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_STARKNET,
    addressEncoding: EAddressEncodings.STARKNET_OKX,
    idSuffix: EAddressEncodings.STARKNET_OKX,
    desc: 'OKX Wallet account',
    useAddressEncodingDerive: true,
  },
  // TEMP(starknet-oz017): remove once funds are off OpenZeppelin v0.17.0 accounts
  starknetOpenZeppelinV017: {
    namePrefix: 'STRK OZ v0.17',
    label: 'OpenZeppelin v0.17',
    template: `m/44'/${COINTYPE_STARKNET}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_STARKNET,
    addressEncoding: EAddressEncodings.STARKNET_OZ_V017,
    idSuffix: EAddressEncodings.STARKNET_OZ_V017,
    desc: 'OpenZeppelin v0.17.0 account (temporary, to move funds out)',
    useAddressEncodingDerive: true,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_STARKNET,
  coinTypeDefault: COINTYPE_STARKNET,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: false,

  supportExportedSecretKeys: [ECoreApiExportedSecretKeyType.privateKey],

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  // Phase 1 ships no resource-bounds editor
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  // backend has no indexer for this chain; on-chain list stays empty, local pending txs still show
  serverHistoryUnsupported: true,

  // STRK20 shielded pool. Runtime availability still needs the remote config
  // (serviceStarknetPrivacy.isPrivacyAvailable); this descriptor only says the
  // chain has the feature at all.
  privacyPool: {
    activation: 'account-opt-in',
    balanceShape: 'pooled',
    poolsPerToken: true,
    requiresRegistration: true,
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
