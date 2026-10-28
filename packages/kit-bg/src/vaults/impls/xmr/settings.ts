// cspell:ignore piconero unshield
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  XMR_BUILT_IN_NODE_URLS,
  XMR_EARLIEST_SCAN_HEIGHT,
  XMR_EARLIEST_SCAN_TIMESTAMP_MS,
  XMR_TARGET_BLOCK_SECONDS,
  XMR_TIP_LAG_WARNING_BLOCKS,
} from '@onekeyhq/shared/src/config/xmr';
import {
  COINTYPE_XMR,
  IMPL_XMR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import { XMR_POOL_IDS } from './types';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapXmr = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  cake: IAccountDeriveInfo;
};
export type IAccountDeriveTypesXmr = keyof IAccountDeriveInfoMapXmr;

// BIP-39->Monero has no standard; these two are in wide use. Path shape picks the curve (`getXmrCurveForPath`).
const accountDeriveInfo: IAccountDeriveInfoMapXmr = {
  // Trezor (and OneKey Pro firmware): SLIP-10 ed25519, all hardened.
  default: {
    namePrefix: 'XMR',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_XMR}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_XMR,
    desc: `OneKey, Trezor, m/44'/128'/*'`,
  },
  // Cake Wallet: secp256k1 BIP-32, m/44'/128'/a'/0/0.
  cake: {
    namePrefix: 'XMR Cake',
    label: 'Cake Wallet',
    template: `m/44'/${COINTYPE_XMR}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_XMR,
    desc: `Cake Wallet, m/44'/128'/*'/0/0`,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_XMR,
  coinTypeDefault: COINTYPE_XMR,
  accountDeriveInfo,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  watchingAccountEnabled: false,
  hardwareAccountEnabled: true,
  // Only Pro and Touch firmware has the Monero app.
  supportedDeviceTypes: [EDeviceType.Touch, EDeviceType.Pro],
  externalAccountEnabled: false,
  qrAccountEnabled: false,
  dappInteractionEnabled: false,

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  estimatedFeePollingInterval: 600,
  isNativeTokenContractAddressEmpty: true,
  networkInfo: {
    default: {
      // Unused by the XMR core: the curve follows the account's derive path.
      curve: 'ed25519',
      addressPrefix: '',
    },
  },

  supportExportedSecretKeys: [],
  publicKeyExportEnabled: false,
  mergeDeriveAssetsEnabled: false,
  createAllDeriveTypeAccountsByDefault: false,
  enabledInternalSignAndVerify: false,
  replaceTxEnabled: false,

  editFeeEnabled: false,
  withTxMessage: false,
  defaultFeePresetIndex: 0,
  // Max-send comes from the built tx; a generic balance-minus-fee rewrite
  // would show a different number than the one actually signed.
  ignoreUpdateNativeAmount: true,

  // Every output is private: no transparent pool, shield action or public receive form.
  localWallet: {
    // Scanning costs real bandwidth/CPU, so it's opt-in per account.
    activation: 'account-opt-in',
    balanceShape: 'single',
    publicAddressPattern: '^$',
    // No indexer covers Monero; the runtime is the only source of truth.
    privateAddressPattern:
      '^(?:[1-9A-HJ-NP-Za-km-z]{95}|[1-9A-HJ-NP-Za-km-z]{106})$',
    hiddenEndpointLabelId: ETranslations.private_send_private_option,
    // Base58 lengths for 69..87 address bytes, incl. featured addresses (97/108 chars).
    addressShapePattern: '^[1-9A-HJ-NP-Za-km-z]{95,120}$',
    tipLagWarningBlocks: XMR_TIP_LAG_WARNING_BLOCKS,
    pools: [
      {
        id: XMR_POOL_IDS.private,
        key: 'private',
        kind: 'private',
        source: 'localScan',
        label: 'Monero',
        isDefaultPrivate: true,
      },
    ],
    accountSetup: {
      requiresBirthday: true,
      earliestBirthday: {
        height: XMR_EARLIEST_SCAN_HEIGHT,
        timestamp: XMR_EARLIEST_SCAN_TIMESTAMP_MS,
      },
    },
    // No `publicLabel`: no public pool to produce that address form.
    addressForms: {
      privateLabel: ETranslations.privacy_receive_private_address__title,
    },
    hideAddressOnTokenDetails: true,
    blockTimeSeconds: XMR_TARGET_BLOCK_SECONDS,
    withholdAddressFromBackend: true,
  },

  // Watch-only scans cannot prove outputs unspent without key images; shown as frozen until the password confirms.
  hasFrozenBalance: true,
  showAddressType: false,

  minTransferAmount: '0.000000000001',

  // Payment IDs are legacy; the modern flow is a subaddress per counterparty.
  withPaymentId: false,

  // Txid is fixed once signed, before broadcast; pending reconciliation relies on it.
  withoutBroadcastTxId: false,

  customRpcEnabled: true,
  builtInRpcUrls: XMR_BUILT_IN_NODE_URLS,

  // Inputs are chosen inside the runtime; blockbook does not index Monero.
  coinControlEnabled: false,
  // Bulk send would bypass the prepare/sign/broadcast seam entirely.
  nativeBatchTransferEnabled: false,
};

export default Object.freeze(settings);
