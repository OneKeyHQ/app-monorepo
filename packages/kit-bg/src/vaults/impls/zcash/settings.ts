/* cspell:ignore xprvs */

import {
  ZCASH_CURRENT_SHIELDED_POOL,
  ZCASH_LIGHTWALLETD_MAINNET,
  ZCASH_POOL_IDS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
  ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS,
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
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

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
  // OneKey hardware only; no third-party vendors.
  supportedThirdPartyVendors: undefined,
  accountDeriveInfo,
  impl: IMPL_ZCASH,
  coinTypeDefault: COINTYPE_ZCASH,
  // No minTransferAmount/utxoDustAmount override: the real dust floor is
  // ZCASH_SHIELDING_THRESHOLD_ZAT, enforced by the Shield action.
  // Frozen = total - spendable (pending confirmations + in-flight locks);
  // TokenDetails breaks this down per pool.
  hasFrozenBalance: true,
  showAddressType: false,
  estimatedFeePollingInterval: 60,

  dappInteractionEnabled: false,
  mergeDeriveAssetsEnabled: false,
  qrAccountEnabled: false,
  replaceTxEnabled: false,
  // History combines runtime-owned private rows with backend-owned
  // transparent rows via ServiceHistory, on every platform incl. mobile.
  localWallet: {
    activation: 'account-opt-in',
    feeSetByProtocol: true,
    balanceShape: 'pooled',
    // t1/t3, or a ZIP-320 TEX address (tex1 + 38 bech32m chars).
    publicAddressPattern:
      '^(t[13][1-9A-HJ-NP-Za-km-z]{33}|tex1[02-9ac-hj-np-z]{38})$',
    privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
    hiddenEndpointLabelId: ETranslationsMock.privacy_history_shielded__label,
    historySource: 'vault-authoritative',
    tipLagWarningBlocks: 48,
    // Orchard stays listed: imported seeds may still hold value there (it
    // stopped receiving at NU6.3). Sapling is view-only (no prover), omitted.
    pools: [
      {
        id: ZCASH_POOL_IDS.transparent,
        key: 'transparent',
        kind: 'public',
        source: 'backend',
        label: 'Transparent',
      },
      {
        id: ZCASH_POOL_IDS.ironwood,
        key: 'ironwood',
        kind: 'private',
        source: 'localScan',
        label: 'Ironwood',
        isDefaultPrivate: ZCASH_CURRENT_SHIELDED_POOL === 'ironwood',
      },
      {
        id: ZCASH_POOL_IDS.orchard,
        key: 'orchard',
        kind: 'private',
        source: 'localScan',
        label: 'Orchard',
        isDefaultPrivate: ZCASH_CURRENT_SHIELDED_POOL === 'orchard',
        receivesFunds: false,
      },
    ],
    // Sapling is view-only (no prover): old notes still show in history.
    historyOnlyPools: [{ id: ZCASH_POOL_IDS.sapling, label: 'Sapling' }],
    accountSetup: {
      requiresBirthday: true,
      // Orchard activation: the shielded pools this wallet spends from start here.
      earliestBirthday: {
        height: ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
        timestamp: ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS,
      },
    },
    // Each account adds a trial-decryption key checked against every block
    // (linear cost); 5 keeps low-end devices usable.
    maxEnabledAccounts: 5,
    // Deleting local privacy data also removes the UFVK, so nothing on the
    // device can read the account's shielded history afterwards.
    viewingKeyRetention: 'with-local-data',
    addressForms: {
      publicLabel: ETranslations.privacy_receive_transparent_address__title,
      privateLabel: ETranslations.privacy_receive_private_address__title,
    },
    blockTimeSeconds: ZCASH_TARGET_BLOCK_SECONDS,
    scanRegionHints: [
      {
        fromHeight: ZCASH_SPAM_REGION_START_MAINNET,
        toHeight: ZCASH_SPAM_REGION_END_MAINNET,
        labelId: ETranslations.privacy_sync_spam_region__msg,
      },
    ],
  },
  // ZIP-317 protocol fee; nothing user-editable
  editFeeEnabled: false,
  withTxMessage: false,
  withMemo: true,
  memoMaxLength: 512,
  // buildEncodedTx converges max-send to spendable-fee already; a generic
  // confirm-page rewrite would show a different number than the one signed.
  ignoreUpdateNativeAmount: true,
  // A fully authorized PCZT has a deterministic txid before broadcast;
  // pending reconciliation and rejection recovery both depend on that identity.
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
  hardwareAccountEnabled: true,
  // Custom node here is the lightwalletd the scanner reads from (not just a
  // broadcast override); transparent sends stay on the backend either way.
  customRpcEnabled: true,
  builtInRpcUrls: [ZCASH_LIGHTWALLETD_MAINNET],
  // - note selection happens inside the wasm wallet; the BTC coin-control
  //   screen would call a blockbook backend that does not index zcash
  coinControlEnabled: false,
  // - bulk send would fall into BTC's coin-selection path, bypassing PCZT
  nativeBatchTransferEnabled: false,
};

export default Object.freeze(settings);
