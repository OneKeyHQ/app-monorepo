/* cspell:ignore xprvs */

import {
  ZCASH_CURRENT_SHIELDED_POOL,
  ZCASH_POOL_IDS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  ZCASH_SPAM_REGION_END_MAINNET,
  ZCASH_SPAM_REGION_START_MAINNET,
  ZCASH_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/zcash';
import {
  COINNAME_ZCASH,
  COINTYPE_ZCASH,
  IMPL_ZCASH,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import settingsBtc from '../btc/settings';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'ZEC',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_ZCASH}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_ZCASH,
    coinName: COINNAME_ZCASH,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: 'BIP44, P2PKH, Base58.',
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,
  // Transparent-only skeleton: no third-party hardware vendors, no QR yet.
  supportedThirdPartyVendors: undefined,
  accountDeriveInfo,
  impl: IMPL_ZCASH,
  coinTypeDefault: COINTYPE_ZCASH,
  minTransferAmount: '0.0001',
  utxoDustAmount: '0.0000546',
  // fetchTokenDetails reports frozen = total - spendable (pending
  // confirmations + in-flight locks); the pool block on
  // TokenDetails breaks the same figure down per pool with labeled reasons.
  hasFrozenBalance: true,
  showAddressType: false,
  estimatedFeePollingInterval: 60,

  dappInteractionEnabled: false,
  mergeDeriveAssetsEnabled: false,
  qrAccountEnabled: false,
  replaceTxEnabled: false,
  // History is composed through the standard ServiceHistory pipeline:
  // runtime-owned private/local rows plus backend-owned transparent rows.
  // All platforms, mobile included: the web-embed carrier runs the full
  // single-threaded runtime (real-device Android scan verified; other
  // shielded wallets scan on-device). Mobile posture is foreground-paced
  // scanning; the scheduler already ambles when unattended (battery).
  localWallet: {
    activation: 'account-opt-in',
    balanceShape: 'pooled',
    historySource: 'vault-authoritative',
    tipLagWarningBlocks: 48,
    // Orchard stays listed because imported seeds can still hold value there
    // (it stopped receiving at NU6.3). Sapling is view-only (no prover) and
    // deliberately absent.
    pools: [
      {
        id: ZCASH_POOL_IDS.transparent,
        key: 'transparent',
        kind: 'public',
        label: 'Transparent',
      },
      {
        id: ZCASH_POOL_IDS.ironwood,
        key: 'ironwood',
        kind: 'private',
        label: 'Ironwood',
        isDefaultPrivate: ZCASH_CURRENT_SHIELDED_POOL === 'ironwood',
      },
      {
        id: ZCASH_POOL_IDS.orchard,
        key: 'orchard',
        kind: 'private',
        label: 'Orchard',
        isDefaultPrivate: ZCASH_CURRENT_SHIELDED_POOL === 'orchard',
        receivesFunds: false,
      },
    ],
    accountSetup: { requiresBirthday: true },
    // Every enabled account adds one Orchard key that every block is trial-
    // decrypted against, and the wasm scanner runs that loop inline (no
    // batched trial decryption -- see scan_blocks_inline), so the cost is
    // linear with no amortization. Five keeps a low-end device usable.
    maxEnabledAccounts: 5,
    addressForms: { publicLabel: 'Transparent', privateLabel: 'Unified' },
    blockTimeSeconds: ZCASH_TARGET_BLOCK_SECONDS,
    scanRegionHints: [
      {
        fromHeight: ZCASH_SPAM_REGION_START_MAINNET,
        toHeight: ZCASH_SPAM_REGION_END_MAINNET,
        label: '2022 spam zone',
      },
    ],
  },
  // ZIP-317 protocol fee; nothing user-editable
  editFeeEnabled: false,
  // buildEncodedTx already converges max-send to spendable - fee and the
  // decoded tx reports that exact figure; the generic confirm-page rewrite
  // (balance - fee) would show a different number than the one signed.
  ignoreUpdateNativeAmount: true,
  // A fully authorized PCZT has a deterministic txid before broadcast. Never
  // accept a successful send without it because pending reconciliation and
  // rejection recovery both depend on that identity.
  withoutBroadcastTxId: false,

  createAllDeriveTypeAccountsByDefault: false,
  enabledInternalSignAndVerify: false,
  // A BTC xprv/xpub only covers the transparent branch and is not a complete
  // Zcash backup. Wallet recovery remains mnemonic-only.
  publicKeyExportEnabled: false,
  supportExportedSecretKeys: [],

  // Imported account xprvs can sign t-to-t through the stateless keys runtime.
  // Address/xpub watching accounts remain transparent and read-only.
  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  // - keyringMap.hw is undefined until zcash hardware lands
  hardwareAccountEnabled: true,
  // - getCustomRpcEndpointStatus/broadcastTransactionFromCustomRpc not implemented
  customRpcEnabled: false,
  // - note selection happens inside the wasm wallet; the BTC coin-control
  //   screen would call a blockbook backend that does not index zcash
  coinControlEnabled: false,
  // - bulk send would fall into BTC's coin-selection path, bypassing PCZT
  nativeBatchTransferEnabled: false,
};

export default Object.freeze(settings);
