// cspell:ignore piconero unshield
import {
  XMR_BUILT_IN_NODE_URLS,
  XMR_EARLIEST_SCAN_HEIGHT,
  XMR_EARLIEST_SCAN_TIMESTAMP_MS,
  XMR_MAX_ENABLED_ACCOUNTS,
  XMR_TARGET_BLOCK_SECONDS,
  XMR_TIP_LAG_WARNING_BLOCKS,
} from '@onekeyhq/shared/src/config/xmr';
import {
  COINTYPE_XMR,
  IMPL_XMR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

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

// BIP-39->Monero has no standard; these are the two in wide use. Path shape
// picks the curve (`getXmrCurveForPath`); pinned by derivation.vectors.test.ts.
const accountDeriveInfo: IAccountDeriveInfoMapXmr = {
  // Trezor (and OneKey Pro firmware): SLIP-10 ed25519, all hardened.
  default: {
    namePrefix: 'XMR',
    label: 'OneKey',
    template: `m/44'/${COINTYPE_XMR}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_XMR,
    desc: 'Same addresses as Trezor.',
  },
  // Cake Wallet: secp256k1 BIP-32, m/44'/128'/a'/0/0.
  cake: {
    namePrefix: 'XMR Cake',
    label: 'Cake Wallet compatible',
    template: `m/44'/${COINTYPE_XMR}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_XMR,
    desc: 'Same addresses as Cake Wallet.',
  },
};

const settings: IVaultSettings = {
  impl: IMPL_XMR,
  coinTypeDefault: COINTYPE_XMR,
  accountDeriveInfo,
  // One account = one primary address; subaddresses are runtime-tracked, not
  // account records. SIMPLE, not UTXO (cf. DNX, which indexes each address).
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  watchingAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  qrAccountEnabled: false,
  dappInteractionEnabled: false,

  // One native coin, no tokens or contracts to hold.
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

  // Fee follows the node's recommended rate x priority tier; no
  // user-editable per-byte knob.
  editFeeEnabled: false,
  withTxMessage: false,
  defaultFeePresetIndex: 0,
  // Max-send comes from the built tx; a generic balance-minus-fee rewrite
  // would show a different number than the one actually signed.
  ignoreUpdateNativeAmount: true,

  // Every output is private: no transparent pool, shield/unshield action, or
  // public receive form.
  localWallet: {
    // Scanning costs real bandwidth/CPU, so it's opt-in per account.
    activation: 'account-opt-in',
    // Single pool: keeps the generic pool tabs off the token page.
    balanceShape: 'single',
    // Monero has no public address endpoints in transaction history.
    publicAddressPattern: '^$',
    // No third-party indexer covers Monero (unlike blockbook for transparent
    // Zcash): the runtime is the only source of truth here.
    privateAddressPattern:
      '^(?:[1-9A-HJ-NP-Za-km-z]{95}|[1-9A-HJ-NP-Za-km-z]{106})$',
    hiddenEndpointLabelId: ETranslationsMock.privacy_history_private__label,
    // Base58 lengths of 69..87 address bytes: every type monero-address
    // parses, incl. featured addresses (97/108 chars).
    addressShapePattern: '^[1-9A-HJ-NP-Za-km-z]{95,120}$',
    historySource: 'vault-authoritative',
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
    maxEnabledAccounts: XMR_MAX_ENABLED_ACCOUNTS,
    // Receive needs the view key whether or not scanning is on.
    viewingKeyRetention: 'until-account-removed',
    withholdAddressFromBackend: true,
  },

  // Watch-only wallets can't detect spent outputs (needs key images from the
  // spend key), so the balance reads high until imported; surfaced, not hidden.
  hasFrozenBalance: true,
  showAddressType: false,

  // One piconero, the smallest representable amount.
  minTransferAmount: '0.000000000001',

  // Payment IDs are legacy; the modern flow is a subaddress per counterparty.
  withPaymentId: false,

  // Txid is deterministic once signed, before broadcast; pending
  // reconciliation depends on that identity.
  withoutBroadcastTxId: false,

  // No backend index for this chain; the node is the sole source of truth.
  // Custom RPC is the privacy story: whoever serves blocks sees what we ask for.
  customRpcEnabled: true,
  builtInRpcUrls: XMR_BUILT_IN_NODE_URLS,

  // Coin control would call a blockbook backend that doesn't index Monero;
  // inputs are chosen inside the runtime anyway.
  coinControlEnabled: false,
  // Bulk send would bypass the prepare/sign/broadcast seam entirely.
  nativeBatchTransferEnabled: false,
};

export default Object.freeze(settings);
