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
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  supportedThirdPartyVendors: undefined,
  accountDeriveInfo,
  impl: IMPL_ZCASH,
  coinTypeDefault: COINTYPE_ZCASH,
  hideTxUtxoListWhenPending: true,
  disabledSwapAction: true,
  // No minTransferAmount/utxoDustAmount override: the real dust floor is
  // ZCASH_SHIELDING_THRESHOLD_ZAT, enforced by the Shield action.
  hasFrozenBalance: true,
  showAddressType: false,
  estimatedFeePollingInterval: 60,

  dappInteractionEnabled: false,
  mergeDeriveAssetsEnabled: false,
  qrAccountEnabled: false,
  replaceTxEnabled: false,
  localWallet: {
    activation: 'account-opt-in',
    feeSetByProtocol: true,
    balanceShape: 'pooled',
    // t1/t3, or a ZIP-320 TEX address (tex1 + 38 bech32m chars).
    publicAddressPattern:
      '^(t[13][1-9A-HJ-NP-Za-km-z]{33}|tex1[02-9ac-hj-np-z]{38})$',
    privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
    hiddenEndpointLabelId: ETranslations.privacy_history_shielded__title,
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
  editFeeEnabled: false,
  withTxMessage: false,
  withMemo: true,
  memoMaxLength: 512,
  // buildEncodedTx already converges max-send to spendable-fee; a confirm-page rewrite would differ from the signed amount.
  ignoreUpdateNativeAmount: true,
  // A fully authorized PCZT has a deterministic txid before broadcast; pending reconciliation depends on it.
  withoutBroadcastTxId: false,

  createAllDeriveTypeAccountsByDefault: false,
  enabledInternalSignAndVerify: false,
  // A BTC xprv/xpub covers only the transparent branch; wallet recovery stays mnemonic-only.
  publicKeyExportEnabled: false,
  supportExportedSecretKeys: [],

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  hardwareAccountEnabled: true,
  // The lightwalletd the scanner reads from; transparent sends stay on the backend either way.
  customRpcEnabled: true,
  builtInRpcUrls: [ZCASH_LIGHTWALLETD_MAINNET],
  // - note selection happens inside the wasm wallet; the BTC coin-control
  //   screen would call a blockbook backend that does not index zcash
  coinControlEnabled: false,
  // - bulk send would fall into BTC's coin-selection path, bypassing PCZT
  nativeBatchTransferEnabled: false,
};

export default Object.freeze(settings);
