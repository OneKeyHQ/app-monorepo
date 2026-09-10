/* cspell:ignore Ufvks */
import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import { getAddressFromXpub } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IUtxoInfo } from '@onekeyhq/core/src/chains/btc/types';
import {
  encodeAddress as encodeZcashAddress,
  getZcashAccountIndexFromXpub,
  isShieldedAddress,
  validateZcashAddress,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import {
  ZCASH_ADDRESS_SCHEME_VERSION,
  ZCASH_CURRENT_SHIELDED_POOL,
  ZCASH_DECIMALS,
  ZCASH_LIGHTWALLETD_MAINNET,
  ZCASH_NETWORK_MAIN,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import {
  ensureAutoToast,
  toUserFacingZcashError,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/errorCopy';
import {
  LOCK_FOR_BLOCKS,
  TRANSPARENT_TX_EXPIRY_DELTA,
  TRUSTED_CONFIRMATIONS,
  UNTRUSTED_CONFIRMATIONS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/policy';
import {
  readZcashRuntimeError,
  zcashErrorAmount,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashBalance,
  IZcashHistoryItem,
  IZcashPcztReservation,
  IZcashPoolDetail,
  IZcashSpendSource,
  IZcashSyncProgress,
  IZcashTransparentOutpoint,
  IZcashTransparentTxQuote,
  IZcashTransparentTxRequest,
  IZcashTxDetails,
  IZcashWalletAccount,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { ZCASH_SHIELDING_THRESHOLD_ZAT } from '@onekeyhq/shared/src/config/zcash';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import { composePrivacyChainBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import {
  appendMissingPrivacyChainHistoryTxs,
  isPrivacyChainHistoryComplete,
  mergePrivacyChainHistoryTxs,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import {
  privacyChainPerfLog,
  privacyChainPerfSpan,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
} from '@onekeyhq/shared/types/address';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type { ITokenData, ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import VaultBtc from '../btc/Vault';

import {
  fetchCompleteZcashBackendHistory,
  normalizeZcashBackendHistoryTx,
} from './backendHistory';
import {
  applyZcashBalanceToBackendTokenDetails,
  applyZcashBalanceToBackendTokenList,
} from './backendToken';
import {
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
} from './birthday';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getZcashLifecycleMutex, getZcashSyncMutex } from './lifecycle';
import {
  buildZcashLocalHistoryTx,
  findZcashLocalHistoryItem,
} from './localHistory';

import type { IEncodedTxZcash } from './types';
import type { IDBUtxoAccount, IDBWalletType } from '../../../dbs/local/types';
import type {
  IZcashAccountMeta,
  IZcashBirthdaySource,
  IZcashPendingRescan,
  IZcashTransparentPendingTx,
} from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  ILocalWalletAccountBalance,
  ILocalWalletCapability,
  ILocalWalletPoolBalance,
  ILocalWalletSendPool,
} from '../../localWallet/types';
import type {
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IRescanLocalWalletFrom,
  IUpdateUnsignedTxParams,
} from '../../types';

// ZIP-317 conventional fee shown before pczt_create computes the real one:
// marginal fee 5000 zat × 2 logical actions = 10000 for the common transfer
// (matches the wasm proposer's requirement observed in the E2E probe); spends
// with more notes can be higher (display-only estimate).
const ZCASH_DISPLAY_FEE_ZAT = '10000';

const ZCASH_TRANSPARENT_PATH_RE = /^m\/44'\/133'\/(\d+)'\/([01])\/(\d+)$/;
const ZCASH_TRANSPARENT_P2PKH_SCRIPT_RE = /^76a914[0-9a-f]{40}88ac$/i;

function zcashTransparentError(
  code: string,
  message: string,
  params: Record<string, unknown> = {},
): OneKeyLocalError {
  return Object.assign(new OneKeyLocalError(message), { code, params });
}

function sameOutpoints(
  left: IZcashTransparentOutpoint[],
  right: IZcashTransparentOutpoint[],
): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map((item) => `${item.txid}:${item.vout}`));
  return left.every((item) => rightKeys.has(`${item.txid}:${item.vout}`));
}

export function isTerminalTransparentHistoryStatus(
  status: EDecodedTxStatus,
): boolean {
  return status !== EDecodedTxStatus.Pending;
}

export function shouldPreferTransparentForShieldedSend({
  enabled,
  toAddress,
}: {
  enabled: boolean;
  toAddress: string;
}): boolean {
  return enabled && isShieldedAddress(toAddress);
}

function getZcashSendSpendable(
  balance: IZcashBalance,
  spendSource: IZcashSpendSource,
  spendTransparent: boolean,
): BigNumber {
  return new BigNumber(balance.poolsDetail[spendSource].spendable).plus(
    spendTransparent ? balance.poolsDetail.transparentRegular.spendable : '0',
  );
}

// Zcash vault. Account backbone reuses the BTC UTXO machinery (transparent
// t-addr = account.address, xpub stored); shielded state (UFVK/UA, balances,
// "Setup never completed" is a state, not a transient fault, and callers must
// be able to tell the two apart WITHOUT matching on message text (which would
// break the moment the wording or i18n changes). Tagged property, checked by
// isZcashSetupIncompleteError.
const ZCASH_SETUP_INCOMPLETE = 'zcashSetupIncomplete';

// Pool keys arrive as plain strings from settings.localWallet.pools; only the
// spendable private pools are valid spend sources.
function zcashSpendSourceFromKey(
  key: string | undefined,
): IZcashSpendSource | undefined {
  if (key === 'orchard' || key === 'ironwood') {
    return key;
  }
  return undefined;
}

// Failures that mean the on-disk database itself is unusable, as opposed to
// a transient network or lease problem.
function isZcashRuntimeDatabaseBroken(e: unknown): boolean {
  const runtimeError = readZcashRuntimeError(e);
  if (!runtimeError || runtimeError.code !== 'DATABASE_ERROR') {
    return false;
  }
  const operation = (runtimeError.params as { operation?: unknown } | undefined)
    ?.operation;
  if (operation === 'migrate') {
    return true;
  }
  return /malformed|corrupt/i.test(runtimeError.detail ?? '');
}

function createZcashSetupIncompleteError(): Error {
  const error = new OneKeyLocalError(
    'zcash: shielded account setup never completed (use retryLocalWalletSetup to retry)',
  );
  (error as unknown as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] = true;
  return error;
}

function isZcashSetupIncompleteError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    (e as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] === true
  );
}

// The runtime throws a real Error whose `message` is only the error CODE
// (e.g. "NETWORK_ERROR"). The two fields that actually identify the failure
// hang off the object as extra properties: `params.operation` (which call
// failed) and `detail` (the upstream error text). Logging a bare `e.message`
// throws both away and leaves an unactionable one-word log line, so pull them
// out for every zcash catch site.
function zcashDescribeError(e: unknown): {
  error: string;
  operation?: string;
  detail?: string;
} {
  const error = e instanceof Error ? e.message : String(e);
  // This runs in the background, which for extension and mobile is on the far
  // side of a carrier boundary. The flat `params`/`detail` do not survive that
  // hop, so reading them directly logged nothing but a code on those platforms
  // while looking complete on desktop.
  const runtime = readZcashRuntimeError(e);
  if (!runtime) {
    return { error };
  }
  const operation =
    typeof runtime.params.operation === 'string'
      ? runtime.params.operation
      : undefined;
  return { error, operation, detail: runtime.detail };
}

// history, PCZT send) is computed client-side by the runtime carrier. The
// OneKey backend owns the transparent half; the runtime owns every shielded
// pool. Hardware and QR are deferred; signing goes through the PCZT/WASM path,
// never BTC sighash.
export default class Vault extends VaultBtc {
  override coreApi = coreChainApi.zec.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override getBlockbookCoinName() {
    return 'Zcash';
  }

  // BTC's validateAddress parses via single-byte bitcoinjs and cannot read
  // Zcash's 2-byte t-address prefixes; override to decode t1/t3 first and
  // reject shielded addresses (shielded sends land with the PCZT flow).
  override async validateAddress(address: string) {
    return validateZcashAddress({
      address,
      network: await this.getBtcForkNetwork(),
    });
  }

  // ---------------------------------------------- zcash carrier plumbing

  async zcashGetApi() {
    const zcashSdk = (
      await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
    ).default;
    return zcashSdk.getZcashApi();
  }

  // Debug door for "why did that read feel slow". Off by default: the trace
  // fires several times a second during a boost, and that volume alone can
  // make a console-attached page crawl -- the measurement must not create the
  // thing being measured.
  async zcashSetPerfTrace({ enabled }: { enabled: boolean }): Promise<void> {
    const api = await this.zcashGetApi();
    await api.setPerfTrace({ enabled });
  }

  // Addresses are a cache of (UFVK × ZCASH_ADDRESS_SCHEME_VERSION); stale
  // stamps re-derive from the persisted UFVK (no seed, no password).
  async zcashGetAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta || meta.addressSchemeVersion === ZCASH_ADDRESS_SCHEME_VERSION) {
      return meta;
    }
    try {
      const api = await this.zcashGetApi();
      const derived = await api.deriveAddressFromUfvk({
        network: ZCASH_NETWORK_MAIN,
        ufvk: meta.ufvk,
        lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
      });
      const healed: IZcashAccountMeta = {
        ...meta,
        unifiedAddress: derived.unifiedAddress,
        transparentAddress: derived.transparentAddress,
        addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      };
      await this.backgroundApi.simpleDb.zcash.saveAccountMeta({
        accountId,
        meta: healed,
      });
      return healed;
    } catch (e) {
      console.error('[zcash] address cache self-heal failed', {
        accountId,
        error: e instanceof Error ? e.message : String(e),
      });
      return meta;
    }
  }

  async zcashGetWalletAccount({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashWalletAccount> {
    const meta = await this.zcashGetAccountMeta({ accountId });
    if (!meta) {
      // Meta is only ever written by KeyringHd.zcashDeriveAndSaveAccountMeta,
      // called once during account creation (prepareAccounts). If it's
      // missing here, that one attempt didn't complete -- most likely a
      // transient lightwalletd/network failure (see KeyringHd's own
      // "shielded account meta derivation failed" log for the real cause).
      // Recover via ServicePrivacyChain.retryLocalWalletSetup (password-
      // gated re-derive in place) -- never delete and re-add the account.
      console.log(
        '[zcash] shielded account meta missing -- initial derivation ' +
          'never completed (see "shielded account meta derivation failed" ' +
          'for why); call ServicePrivacyChain.retryLocalWalletSetup to retry',
        { accountId },
      );
      throw createZcashSetupIncompleteError();
    }
    return {
      network: ZCASH_NETWORK_MAIN,
      lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
      ufvk: meta.ufvk,
      seedFingerprintHex: meta.seedFingerprintHex,
      hdIndex: meta.hdIndex,
      birthdayHeight: meta.birthdayHeight,
    };
  }

  // ------------------------------- PCZT operations (signing in KeyringHd)

  private async zcashReplayUnknownTransparentBroadcast({
    accountId,
    tx,
  }: {
    accountId: string;
    tx: IZcashTransparentPendingTx;
  }): Promise<void> {
    try {
      const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      });
      // VaultBtc's broadcast goes straight to the backend; the zcash override
      // above is for freshly signed transactions only.
      const result = await super.broadcastTransaction({
        accountId,
        networkId: this.networkId,
        accountAddress: dbAccount.address,
        signedTx: { txid: tx.txid, rawTx: tx.rawTx, encodedTx: null },
      });
      if (result.txid.toLowerCase() === tx.txid.toLowerCase()) {
        await this.backgroundApi.simpleDb.zcash.markTransparentPendingTxAccepted(
          { accountId, txid: tx.txid },
        );
      }
    } catch (e) {
      console.log('[zcash] transparent rebroadcast outcome still unknown', {
        accountId,
        txid: tx.txid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async zcashAssertNoUnresolvedBroadcast(
    accountId: string,
    excludeShieldedReservationId?: string,
  ) {
    let [transparentPending, shieldedReservations] = await Promise.all([
      this.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
        accountId,
      }),
      this.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId,
      }),
    ]);
    if (transparentPending.length > 0) {
      let currentHeight: number | undefined;
      try {
        // This is an indexer read and does not initialize the wallet runtime.
        // Consensus height is the only authority allowed to unlock an input;
        // if the tip cannot be fetched, the transaction stays fail-closed.
        currentHeight = (await this.zcashFetchFreshTransparentUtxos())
          .targetHeight;
      } catch {
        currentHeight = undefined;
      }
      await this.backgroundApi.simpleDb.zcash.pruneExpiredTransparentState({
        accountId,
        currentHeight,
      });
      transparentPending =
        await this.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
          accountId,
        });
    }
    // Re-read after the indexer await so a just-created private reservation
    // cannot slip through the lifecycle guard. Only consensus height may
    // expire an abandoned reservation; never age out the host journal alone.
    shieldedReservations =
      await this.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId,
      });
    const [meta, privacyModeEnabled] = await Promise.all([
      this.backgroundApi.simpleDb.zcash.getAccountMeta({ accountId }),
      this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({ accountId }),
    ]);
    if (excludeShieldedReservationId) {
      shieldedReservations = shieldedReservations.filter(
        ({ reservationId }) => reservationId !== excludeShieldedReservationId,
      );
    }
    // A PCZT built for a review page the user walked away from is never
    // going to be broadcast: unlock its inputs instead of blocking new sends.
    const abandonedReservations = shieldedReservations.filter(
      ({ state }) => state === 'unsigned',
    );
    if (abandonedReservations.length > 0 && meta) {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      for (const { reservationId } of abandonedReservations) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.releasePczt(account, { reservationId });
          // eslint-disable-next-line no-await-in-loop
          await this.backgroundApi.simpleDb.zcash.removeShieldedReservation({
            accountId,
            reservationId,
          });
        } catch {
          // Keep the journal and fail closed below.
        }
      }
      shieldedReservations = (
        await this.backgroundApi.simpleDb.zcash.listShieldedReservations({
          accountId,
        })
      ).filter(
        ({ reservationId }) => reservationId !== excludeShieldedReservationId,
      );
    }
    let currentShieldedHeight: number | null = null;
    if (
      shieldedReservations.some(
        ({ expiryHeight }) => expiryHeight !== undefined,
      )
    ) {
      try {
        currentShieldedHeight = await this.getLocalWalletChainTip();
      } catch {
        currentShieldedHeight = null;
      }
    }
    const expiredShieldedReservations = shieldedReservations.filter(
      ({ expiryHeight }) =>
        expiryHeight !== undefined &&
        currentShieldedHeight !== null &&
        expiryHeight < currentShieldedHeight,
    );
    if (expiredShieldedReservations.length > 0 && meta) {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      for (const { reservationId } of expiredShieldedReservations) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.releasePczt(account, { reservationId });
          // eslint-disable-next-line no-await-in-loop
          await this.backgroundApi.simpleDb.zcash.removeShieldedReservation({
            accountId,
            reservationId,
          });
        } catch {
          // Keep the journal and fail closed below. A later retry can release
          // it after the carrier recovers.
        }
      }
      shieldedReservations =
        await this.backgroundApi.simpleDb.zcash.listShieldedReservations({
          accountId,
        });
      if (excludeShieldedReservationId) {
        shieldedReservations = shieldedReservations.filter(
          ({ reservationId }) => reservationId !== excludeShieldedReservationId,
        );
      }
    }
    let privatePendingTxids: string[] = [];
    if (meta && (privacyModeEnabled || shieldedReservations.length > 0)) {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      privatePendingTxids = await api.getPendingBroadcasts(account);
    }
    const pendingTxids = Array.from(
      new Set([
        ...privatePendingTxids,
        ...transparentPending.map((tx) => tx.txid),
      ]),
    );
    if (pendingTxids.length > 0 || shieldedReservations.length > 0) {
      const error = new OneKeyLocalError(
        'A previous Zcash transaction is still awaiting confirmation. Refresh history, or retry in 15 minutes.',
      );
      Object.assign(error, {
        code: 'UNRESOLVED_ZCASH_BROADCAST',
        params: {
          txids: pendingTxids,
          retryAfterMinutes: 15,
          canRecheck: true,
          activeShieldedReservations: shieldedReservations.length,
        },
      });
      throw error;
    }
  }

  async zcashAssertNoUnresolvedBroadcastWithLifecycleLock(
    accountId: string,
  ): Promise<void> {
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta) {
      await this.zcashAssertNoUnresolvedBroadcast(accountId);
      return;
    }
    const lifecycleMutex = getZcashLifecycleMutex(meta.ufvk);
    await lifecycleMutex.runExclusive(() =>
      this.zcashAssertNoUnresolvedBroadcast(accountId),
    );
  }

  async zcashCreatePczt(params: {
    accountId: string;
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    reservationId?: string;
    spendTransparent?: boolean;
  }): Promise<IZcashPcztReservation> {
    await this.zcashAssertNoUnresolvedBroadcast(
      params.accountId,
      params.reservationId,
    );
    const account = await this.zcashGetWalletAccount({
      accountId: params.accountId,
    });
    const api = await this.zcashGetApi();
    try {
      return await api.createPczt(account, {
        toAddress: params.toAddress,
        valueZat: params.valueZat,
        spendSource: params.spendSource,
        spendTransparent: params.spendTransparent,
        reservationId: params.reservationId,
      });
    } catch (e) {
      // The runtime's message is the bare error code; the standard proxy
      // toasts `message`, so this boundary swaps in the user wording while
      // keeping the structured fields.
      throw toUserFacingZcashError(e);
    }
  }

  // "Shield transparent balance" button (docs/02). Same prove -> sign ->
  // send pipeline as a normal transfer; only this create step differs.
  async zcashShieldFunds(params: {
    accountId: string;
    reservationId?: string;
  }): Promise<IZcashPcztReservation> {
    await this.zcashAssertNoUnresolvedBroadcast(
      params.accountId,
      params.reservationId,
    );
    const account = await this.zcashGetWalletAccount({
      accountId: params.accountId,
    });
    const api = await this.zcashGetApi();
    try {
      return await api.shieldFunds(account, {
        reservationId: params.reservationId,
      });
    } catch (e) {
      // INSUFFICIENT_FUNDS while the UI shows a transparent balance almost
      // always means the deposit is still inside the confirmation window
      // (untrusted UTXOs need 10). Say that instead of "insufficient".
      if (readZcashRuntimeError(e)?.code === 'INSUFFICIENT_FUNDS') {
        const dbAccount = (await this.backgroundApi.serviceAccount
          .getDBAccount({ accountId: params.accountId })
          .catch(() => null)) as IDBUtxoAccount | null;
        const indexer = dbAccount
          ? await this.zcashGetIndexerTransparentBalance({
              account: dbAccount,
            }).catch(() => null)
          : null;
        const maturing = indexer
          ? indexer.total.minus(indexer.spendable)
          : new BigNumber(0);
        if (maturing.gt(0)) {
          throw ensureAutoToast(
            new Error(
              `Transparent balance is still confirming (${maturing
                .shiftedBy(-8)
                .toFixed()} ZEC) — try again in a few minutes.`,
            ),
          );
        }
      }
      throw e;
    }
  }

  async zcashReleasePczt(params: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    const account = await this.zcashGetWalletAccount({
      accountId: params.accountId,
    });
    const api = await this.zcashGetApi();
    await api.releasePczt(account, { reservationId: params.reservationId });
  }

  async zcashGetShieldedReservationExpiryHeight(): Promise<number> {
    const chainTip = await this.getLocalWalletChainTip();
    if (chainTip === null) {
      throw new OneKeyLocalError(
        'zcash: chain tip is unavailable for input reservation',
      );
    }
    return chainTip + LOCK_FOR_BLOCKS;
  }

  async zcashProvePczt(params: {
    accountId: string;
    pcztHex: string;
  }): Promise<{ pcztHex: string }> {
    const account = await this.zcashGetWalletAccount({
      accountId: params.accountId,
    });
    const api = await this.zcashGetApi();
    try {
      return await api.provePczt(account, { pcztHex: params.pcztHex });
    } catch (e) {
      throw toUserFacingZcashError(e);
    }
  }

  // ------------------------------------- local wallet state (privacy hooks)

  override getLocalWalletCapability(): ILocalWalletCapability {
    return {
      syncPolicy: {
        maxSyncDurationMs: timerUtils.getTimeDurationMs({ minute: 5 }),
        foregroundBackfillDelayMs: 500,
        backgroundBackfillDelayMs: {
          desktop: timerUtils.getTimeDurationMs({ seconds: 5 }),
          default: timerUtils.getTimeDurationMs({ seconds: 30 }),
        },
        autoBoostMinRemainingBlocks: 10_000,
      },
      listAccounts: () => this.listLocalWalletAccounts(),
      listSendPools: (params) => this.listLocalWalletSendPools(params),
      getAccountAliases: (params) => this.getLocalWalletAccountAliases(params),
      getChainTip: () => this.getLocalWalletChainTip(),
      onWalletCreated: (params) => this.onPrivacyWalletCreated(params),
      resumePendingOperations: () => this.resumePendingPrivacyOperations(),
      gcWalletState: (params) => this.gcPrivacyWalletState(params),
      assertCanRemoveAccount: ({ accountId }) =>
        this.zcashAssertNoUnresolvedBroadcastWithLifecycleLock(accountId),
      syncGroup: (params) => this.syncLocalWalletGroup(params),
      syncCompletionIsAuthoritative:
        !platformEnv.isNative && !platformEnv.isExtension,
      reset: (params) => this.resetLocalWallet(params),
      recoverFromTimeout: () => this.recoverLocalWalletFromTimeout(),
      dropLocalData: async () => {
        const api = await this.zcashGetApi();
        await api.dropWalletDatabase(ZCASH_NETWORK_MAIN);
        // The host journals (reservations, pending txs, metas) describe the
        // database that was just deleted; keeping them would drift apart.
        await this.backgroundApi.simpleDb.zcash.clearRawData();
        await this.backgroundApi.simpleDb.privacyChain.clearRawData();
      },
      setDiagnosticsEnabled: (params) => this.zcashSetPerfTrace(params),
      getSyncProgress: (params) => this.getLocalWalletSyncProgress(params),
      rescan: (params) => this.rescanLocalWallet(params),
      // Account opt-in lifecycle. ServiceZcash owns the mutexes and journal;
      // this only maps its state into the chain-agnostic shape.
      getAccountState: async ({ accountId }) => {
        const state = await this.backgroundApi.serviceZcash.getPrivacyModeState(
          {
            accountId,
          },
        );
        return {
          enabled: state.intent === 'on' && state.operation === undefined,
          pendingOperation: state.operation?.type,
          preferPublicSends: state.preferTransparentForShieldedSends === true,
          birthdayHeight: state.birthdayHeight,
          birthdaySource: state.birthdaySource,
          birthdayTimestamp: state.birthdayTimestamp,
          birthdayHintTimestamp: state.birthdayMonthHint?.timestamp,
        };
      },
      getAccountBalance: ({ accountId }) =>
        this.getLocalWalletAccountBalance({ accountId }),
      enableAccount: (params) =>
        this.backgroundApi.serviceZcash.enablePrivacyMode({
          networkId: this.networkId,
          ...params,
        }),
      disableAccount: ({ accountId }) =>
        this.backgroundApi.serviceZcash.disablePrivacyMode({
          networkId: this.networkId,
          accountId,
        }),
      retryAccountSetup: ({ accountId }) =>
        this.backgroundApi.serviceZcash.retryLocalWalletSetup({
          networkId: this.networkId,
          accountId,
        }),
      setAccountSendPreference: ({ accountId, preferPublic }) =>
        this.backgroundApi.serviceZcash.setPreferTransparentForShieldedSends({
          networkId: this.networkId,
          accountId,
          enabled: preferPublic,
        }),
      getAccountAddresses: async ({ accountId }) => {
        const meta =
          await this.backgroundApi.serviceZcash.getLocalWalletAccountMeta({
            networkId: this.networkId,
            accountId,
          });
        if (!meta) {
          return undefined;
        }
        return {
          publicAddress: meta.transparentAddress,
          privateAddress: meta.unifiedAddress,
        };
      },
      deleteAccountData: ({ accountId }) =>
        this.backgroundApi.serviceZcash.deleteLocalPrivacyData({
          networkId: this.networkId,
          accountId,
        }),
    };
  }

  // Only a freshly generated mnemonic can safely start scanning at the tip;
  // everything else has to assume older history exists. The scheduler cannot
  // know that rule, so it just forwards the event.
  async onPrivacyWalletCreated({
    walletId,
    isFreshlyGeneratedMnemonic,
    createdAt,
  }: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.zcash.saveWalletCreationProvenance({
      walletId,
      isFreshlyGeneratedMnemonic,
      createdAt,
    });
    if (isFreshlyGeneratedMnemonic) {
      const accountIds = (
        await this.backgroundApi.simpleDb.zcash.listPrivacyModeAccountIds()
      ).filter(
        (accountId) =>
          accountUtils.getWalletIdFromAccountId({ accountId }) === walletId,
      );
      await this.backgroundApi.simpleDb.zcash.backfillPrivacyModeBirthdayMonthHint(
        {
          accountIds,
          birthdayMonthHint: {
            timestamp: createdAt,
            source: 'created-wallet',
          },
        },
      );
    }
  }

  async resumePendingPrivacyOperations(): Promise<void> {
    await this.backgroundApi.simpleDb.zcash.cancelPendingPrivacyModeEnables();
    const accountIds =
      await this.backgroundApi.simpleDb.zcash.listPendingPrivacyModeDisables();
    for (const accountId of accountIds) {
      // eslint-disable-next-line no-await-in-loop
      await this.backgroundApi.simpleDb.zcash.completePrivacyModeDisable({
        accountId,
      });
    }
  }

  async gcPrivacyWalletState({
    liveWalletIds,
  }: {
    liveWalletIds: string[];
  }): Promise<void> {
    const live = new Set(liveWalletIds);
    const stored =
      await this.backgroundApi.simpleDb.zcash.listWalletBirthdayStateIds();
    for (const walletId of stored) {
      if (!live.has(walletId)) {
        // eslint-disable-next-line no-await-in-loop
        await this.backgroundApi.simpleDb.zcash.removeWalletBirthdayState({
          walletId,
        });
      }
    }
  }

  async listLocalWalletAccounts(): Promise<{
    accounts: {
      accountId: string;
      runtimeKey: string;
      accountRuntimeKey: string;
      syncEnabled: boolean;
    }[];
    cleanupAccountIds: string[];
  }> {
    const [accountIds, enabledAccountIds] = await Promise.all([
      this.backgroundApi.simpleDb.zcash.listAccountIds(),
      this.backgroundApi.simpleDb.zcash.listPrivacyModeEnabledAccountIds(),
    ]);
    const enabled = new Set(enabledAccountIds);
    const accounts: {
      accountId: string;
      runtimeKey: string;
      accountRuntimeKey: string;
      syncEnabled: boolean;
    }[] = [];
    for (const accountId of accountIds) {
      // eslint-disable-next-line no-await-in-loop
      const account = await this.zcashGetWalletAccount({ accountId });
      accounts.push({
        accountId,
        // The carrier owns one database per network across every seed. The
        // scheduler key must match that physical sync domain so one new tip
        // produces one bounded scan turn.
        runtimeKey: account.network,
        accountRuntimeKey: account.ufvk,
        syncEnabled: enabled.has(accountId),
      });
    }
    return {
      accounts,
      cleanupAccountIds:
        await this.backgroundApi.simpleDb.zcash.listCleanupAccountIds(),
    };
  }

  async getLocalWalletAccountAliases({
    accountId,
  }: {
    accountId: string;
  }): Promise<string[]> {
    const targetMeta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!targetMeta) {
      return [accountId];
    }
    const metas = await this.backgroundApi.simpleDb.zcash.listAccountMetas();
    return metas.flatMap((item) =>
      item.meta.ufvk === targetMeta.ufvk ? [item.accountId] : [],
    );
  }

  private async zcashPrepareAccounts({
    accountIds,
    chainTip,
  }: {
    accountIds: string[];
    chainTip?: number | null;
  }): Promise<IZcashWalletAccount[]> {
    const accounts: IZcashWalletAccount[] = [];
    for (const accountId of accountIds) {
      // eslint-disable-next-line no-await-in-loop
      accounts.push(await this.zcashGetWalletAccount({ accountId }));
    }
    await this.zcashHealOutOfRangeBirthdays({ accountIds, accounts, chainTip });
    const api = await this.zcashGetApi();
    await api.prepareWalletAccounts(accounts);

    // A later import can add an alias of an already-registered UFVK with an
    // earlier birthday. The runtime intentionally treats UFVK as the identity,
    // so a plain prepare finds the existing account and cannot discover the
    // newly required range. Detect that mismatch from the runtime's own
    // account status and repair it through the durable journal. removeAccount
    // refuses while a PCZT reservation or runtime-owned outgoing transaction
    // is active, so normal sending is never purged underneath the user.
    const groups = new Map<
      string,
      { accountId: string; account: IZcashWalletAccount; aliases: string[] }
    >();
    for (let index = 0; index < accounts.length; index += 1) {
      const candidate = accounts[index];
      const existing = groups.get(candidate.ufvk);
      if (!existing) {
        groups.set(candidate.ufvk, {
          accountId: accountIds[index],
          account: candidate,
          aliases: [accountIds[index]],
        });
      } else {
        existing.aliases.push(accountIds[index]);
        if (
          candidate.birthdayHeight !== undefined &&
          (existing.account.birthdayHeight === undefined ||
            candidate.birthdayHeight < existing.account.birthdayHeight)
        ) {
          existing.accountId = accountIds[index];
          existing.account = candidate;
        }
      }
    }
    let repairedBirthday = false;
    for (const group of groups.values()) {
      const expectedBirthday = group.account.birthdayHeight;
      if (expectedBirthday === undefined) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const progress = await api.getSyncProgress(group.account);
      if (
        progress.birthdayHeight === null ||
        progress.birthdayHeight <= expectedBirthday
      ) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const meta = await this.zcashGetAccountMeta({
        accountId: group.accountId,
      });
      const repair: IZcashPendingRescan = {
        birthdayHeight: expectedBirthday,
        birthdaySource: meta?.birthdaySource ?? 'automatic-recovery',
        birthdayTimestamp: meta?.birthdayTimestamp,
        requestedAt: Date.now(),
      };
      // eslint-disable-next-line no-await-in-loop
      await this.backgroundApi.simpleDb.zcash.savePendingRescan({
        accountId: group.accountId,
        repair,
      });
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.applyPendingRescan({
          accountId: group.accountId,
          repair,
        });
        repairedBirthday = true;
      } catch (e) {
        // An active PCZT reservation deliberately returns WALLET_BUSY. Keep
        // the journal and the current scan alive; a later scheduler turn will
        // apply the repair after the send completes.
        console.log('[zcash] earlier birthday repair deferred', {
          accountId: group.accountId,
          ...zcashDescribeError(e),
        });
      }
    }
    if (repairedBirthday) {
      await api.prepareWalletAccounts(accounts);
    }
    return accounts;
  }

  // Self-heal birthdays that fall outside the registerable range.
  //
  // Registration fetches the treestate at birthday-1, and lightwalletd has
  // exactly one usable window for that height:
  //   - below Sapling activation there is no treestate at all
  //     (the node reports that no tree state exists)
  //   - above the chain tip the block does not exist yet
  //     ("the requested block is not in the main chain")
  // Either way registration throws -- and because every account sharing a
  // runtime is registered in ONE batch, a single out-of-range birthday takes
  // the whole group down with it: balance, history and progress all stop for
  // every sibling, and nothing recovers on its own.
  //
  // So clamp into range here and persist the correction instead of making
  // someone hunt down the offending account by hand. Both directions are
  // safe: a birthday only ever means "do not scan before this height", so it
  // can cost scan time, never funds. birthdaySource is preserved so the UI
  // still shows where the original value came from.
  private async zcashHealOutOfRangeBirthdays({
    accountIds,
    accounts,
    chainTip,
  }: {
    accountIds: string[];
    accounts: IZcashWalletAccount[];
    chainTip?: number | null;
  }): Promise<void> {
    const persist = async (index: number, height: number, why: string) => {
      const accountId = accountIds[index];
      console.log('[zcash] healing out-of-range birthday', {
        accountId,
        storedBirthday: accounts[index].birthdayHeight,
        healedTo: height,
        why,
      });
      const meta = await this.zcashGetAccountMeta({ accountId });
      if (meta) {
        await this.backgroundApi.simpleDb.zcash.saveAccountMeta({
          accountId,
          meta: { ...meta, birthdayHeight: height },
        });
      }
      // Mutate the in-flight copy too, so THIS registration already uses the
      // healed value instead of failing once more before the next tick.
      accounts[index].birthdayHeight = height;
    };

    // Lower bound first: it needs no chain tip, so it still heals when the
    // network is exactly the thing that is misbehaving.
    for (let i = 0; i < accounts.length; i += 1) {
      const stored = accounts[i].birthdayHeight;
      if (typeof stored === 'number') {
        const clamped = clampZcashBirthdayHeight({ birthdayHeight: stored });
        if (clamped === stored) {
          // eslint-disable-next-line no-continue
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await persist(i, clamped, 'below-sapling');
      }
    }

    let tip = chainTip ?? undefined;
    if (tip === undefined) {
      try {
        tip = (await this.getLocalWalletChainTip()) ?? undefined;
      } catch (e) {
        console.log('[zcash] above-tip birthday heal skipped (no chain tip)', {
          ...zcashDescribeError(e),
        });
        return;
      }
    }
    if (typeof tip !== 'number') {
      return;
    }
    for (let i = 0; i < accounts.length; i += 1) {
      const stored = accounts[i].birthdayHeight;
      if (typeof stored === 'number') {
        const clamped = clampZcashBirthdayHeight({
          birthdayHeight: stored,
          chainTip: tip,
        });
        if (clamped === stored) {
          // eslint-disable-next-line no-continue
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await persist(i, clamped, 'above-chain-tip');
      }
    }
  }

  async resetLocalWalletCarrier(): Promise<void> {
    const api = await this.zcashGetApi();
    await api.resetCarrier();
  }

  async recoverLocalWalletFromTimeout(): Promise<boolean> {
    if (platformEnv.isNative) {
      await new Promise<void>((resolve, reject) => {
        const timerRef: {
          current?: ReturnType<typeof setTimeout>;
        } = {};
        const onReady = () => {
          clearTimeout(timerRef.current);
          appEventBus.off(
            EAppEventBusNames.LoadWebEmbedWebViewComplete,
            onReady,
          );
          resolve();
        };
        timerRef.current = setTimeout(
          () => {
            appEventBus.off(
              EAppEventBusNames.LoadWebEmbedWebViewComplete,
              onReady,
            );
            reject(
              new OneKeyLocalError(
                'zcash: replacement WebEmbed did not become ready',
              ),
            );
          },
          timerUtils.getTimeDurationMs({ seconds: 45 }),
        );
        appEventBus.on(EAppEventBusNames.LoadWebEmbedWebViewComplete, onReady);
        // The provider changes the component key even when already visible,
        // which destroys the old WebView and its wasm execution.
        appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
      });
      return true;
    }
    if (platformEnv.isDesktop) {
      await this.resetLocalWalletCarrier();
      return true;
    }
    if (platformEnv.isExtension) {
      await this.resetLocalWalletCarrier();
      // Extension reset reloads the offscreen document after acknowledging the
      // request. A successful probe can only come from the replacement page.
      await timerUtils.wait(250);
      await this.getLocalWalletChainTip();
      return true;
    }
    return false;
  }

  async getLocalWalletChainTip(): Promise<number | null> {
    const api = await this.zcashGetApi();
    return api.getChainTip({
      network: ZCASH_NETWORK_MAIN,
      lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
    });
  }

  async syncLocalWalletGroup(params: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
  }): Promise<{
    synced: boolean;
    stateChanged?: boolean;
    chainTip?: number | null;
    backfillRemaining?: boolean;
  }> {
    try {
      return await this.syncLocalWalletGroupImpl(params);
    } catch (e) {
      if (!isZcashRuntimeDatabaseBroken(e)) {
        throw e;
      }
      console.error('[zcash] runtime database unusable, rebuilding', {
        ...zcashDescribeError(e),
      });
      await this.zcashRebuildRuntimeDatabase();
      return { synced: false };
    }
  }

  // The runtime database is a cache of the chain keyed by the stored viewing
  // keys. Whenever it cannot be trusted (schema from another runtime build,
  // failed migration, corruption) it is deleted and scanned again from the
  // birthdays -- but never while a broadcast is still unresolved, because
  // the runtime also holds that transaction's intent.
  private async zcashRebuildRuntimeDatabase(): Promise<void> {
    const { accounts } = await this.listLocalWalletAccounts();
    for (const { accountId } of accounts) {
      // eslint-disable-next-line no-await-in-loop
      await this.zcashAssertNoUnresolvedBroadcast(accountId);
    }
    const api = await this.zcashGetApi();
    await api.dropWalletDatabase(ZCASH_NETWORK_MAIN);
    const versions = await api.getRuntimeVersions();
    await this.backgroundApi.simpleDb.privacyChain.saveRuntimeSchemaVersion({
      networkId: this.networkId,
      version: versions.zcash_client_sqlite ?? 'unknown',
    });
    console.log('[zcash] runtime database dropped for rebuild');
  }

  private async zcashEnsureRuntimeSchemaCompatible(): Promise<void> {
    const api = await this.zcashGetApi();
    const versions = await api.getRuntimeVersions();
    const current = versions.zcash_client_sqlite ?? 'unknown';
    const stored =
      await this.backgroundApi.simpleDb.privacyChain.getRuntimeSchemaVersion({
        networkId: this.networkId,
      });
    if (stored === current) {
      return;
    }
    if (stored === undefined) {
      // First run with version tracking: adopt the current database as is.
      await this.backgroundApi.simpleDb.privacyChain.saveRuntimeSchemaVersion({
        networkId: this.networkId,
        version: current,
      });
      return;
    }
    console.log('[zcash] runtime schema changed, rebuilding database', {
      stored,
      current,
    });
    await this.zcashRebuildRuntimeDatabase();
  }

  private async syncLocalWalletGroupImpl({
    chainTip,
    rescanFrom,
  }: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
  }): Promise<{
    synced: boolean;
    stateChanged?: boolean;
    chainTip?: number | null;
    backfillRemaining?: boolean;
  }> {
    return getZcashSyncMutex(ZCASH_NETWORK_MAIN).runExclusive(async () => {
      await this.zcashEnsureRuntimeSchemaCompatible();
      // Refresh inside the scan lane: queued scheduler snapshots can predate
      // another account's enable. Every active key must share scan progress.
      const { accounts: registered } = await this.listLocalWalletAccounts();
      const activeAccountIds: string[] = [];
      for (const candidate of registered) {
        // eslint-disable-next-line no-await-in-loop
        const state =
          await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
            accountId: candidate.accountId,
          });
        if (
          candidate.runtimeKey === ZCASH_NETWORK_MAIN &&
          ((state.intent === 'on' && state.operation === undefined) ||
            state.operation?.type === 'enable')
        ) {
          activeAccountIds.push(candidate.accountId);
        }
      }
      const accountIds = Array.from(new Set(activeAccountIds));
      if (!accountIds.length) {
        return { synced: false };
      }
      // Crash-safety replay first: a birthday change journals before it purges,
      // so a death in between is finished here, before registration reads the
      // corrected meta. Cheap when no journals exist.
      await this.zcashResumePendingRescans();
      if (rescanFrom) {
        try {
          await this.queueLocalWalletRescanFrom(rescanFrom);
        } catch (error) {
          if (readZcashRuntimeError(error)?.code !== 'NOT_SYNCED') {
            throw error;
          }
        }
      }
      const accounts = await this.zcashPrepareAccounts({
        accountIds,
        chainTip,
      });
      // The shared database trial-decrypts for every registered key in one
      // pass, so advancing any one account advances the whole group.
      const accountId = accountIds[0];
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      const result = await api.syncWallet(account, {
        activeUfvks: Array.from(new Set(accounts.map((item) => item.ufvk))),
        chainTip,
      });
      console.log('[zcash] syncLocalWalletGroup result', {
        accountIds,
        ...result,
      });
      return {
        synced: result.synced,
        stateChanged: result.stateChanged,
        chainTip: result.chainTip,
        backfillRemaining: result.backfillRemaining,
      };
    });
  }

  async queueLocalWalletRescanFrom({
    accountId,
    fromHeight,
  }: {
    accountId: string;
    fromHeight: number;
  }): Promise<{ queued: boolean; fromHeight: number; toHeight: number }> {
    const account = await this.zcashGetWalletAccount({ accountId });
    const api = await this.zcashGetApi();
    return api.queueRescanFrom(account, { fromHeight });
  }

  async resetLocalWallet({
    accountId,
    scope,
  }: {
    accountId: string;
    scope: 'cache' | 'all';
  }): Promise<void> {
    if (scope === 'cache') {
      const account = await this.zcashGetWalletAccount({ accountId });
      const lifecycleMutex = getZcashLifecycleMutex(account.ufvk);
      await lifecycleMutex.runExclusive(async () => {
        await this.zcashAssertNoUnresolvedBroadcast(accountId);
        const api = await this.zcashGetApi();
        await api.purgeWallet(account);
      });
      console.log('[zcash] local wallet cache reset', { accountId });
      return;
    }
    const targetMeta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (targetMeta) {
      const lifecycleMutex = getZcashLifecycleMutex(targetMeta.ufvk);
      await lifecycleMutex.runExclusive(async () => {
        await this.zcashAssertNoUnresolvedBroadcast(accountId);
        const metas =
          await this.backgroundApi.simpleDb.zcash.listAccountMetas();
        for (const item of metas) {
          if (
            item.accountId === accountId ||
            item.meta.ufvk !== targetMeta.ufvk
          ) {
            // eslint-disable-next-line no-continue
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const owner =
            await this.backgroundApi.serviceAccount.getDBAccountSafe({
              accountId: item.accountId,
            });
          if (owner) {
            // The same viewing key is still referenced by another app account.
            // Runtime state is keyed by the shared UFVK-derived account UUID,
            // so removing this host alias does not move or duplicate history.
            await this.backgroundApi.simpleDb.zcash.removeAccountState({
              accountId,
            });
            return;
          }
        }
        const account = await this.zcashGetWalletAccount({ accountId });
        const api = await this.zcashGetApi();
        await api.purgeWallet(account);
        await this.backgroundApi.simpleDb.zcash.removeAccountState({
          accountId,
        });
      });
      return;
    }
    // Nothing remains that can locate a runtime account. Drop any orphaned
    // host-only records discovered by cleanup.
    await this.zcashAssertNoUnresolvedBroadcast(accountId);
    await this.backgroundApi.simpleDb.zcash.removeAccountState({ accountId });
  }

  async deleteLocalPrivacyData({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    const targetMeta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!targetMeta) {
      return;
    }
    const lifecycleMutex = getZcashLifecycleMutex(targetMeta.ufvk);
    await lifecycleMutex.runExclusive(async () => {
      const privacyModeState =
        await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
          accountId,
        });
      if (
        privacyModeState.intent !== 'off' ||
        privacyModeState.operation !== undefined
      ) {
        throw new OneKeyLocalError(
          'zcash: Privacy Mode changed while deleting local privacy data',
        );
      }
      await this.zcashAssertNoUnresolvedBroadcast(accountId);
      const aliases =
        await this.backgroundApi.simpleDb.zcash.listAccountMetas();
      let hasLiveAlias = false;
      for (const alias of aliases) {
        if (
          alias.accountId === accountId ||
          alias.meta.ufvk !== targetMeta.ufvk
        ) {
          // eslint-disable-next-line no-continue
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const [owner, aliasPrivacyModeState] = await Promise.all([
          this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId: alias.accountId,
          }),
          this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
            accountId: alias.accountId,
          }),
        ]);
        if (
          owner &&
          (aliasPrivacyModeState.intent === 'on' ||
            aliasPrivacyModeState.operation !== undefined)
        ) {
          hasLiveAlias = true;
          break;
        }
      }
      if (!hasLiveAlias) {
        const account = await this.zcashGetWalletAccount({ accountId });
        const api = await this.zcashGetApi();
        await api.purgeWallet(account);
      }
      // removeAccountMeta deliberately retains the account's mode/birthday
      // record. The next explicit enable can derive the UFVK again and reuse
      // the same recovery month without reviving any cached private data.
      await this.backgroundApi.simpleDb.zcash.removeAccountMeta({ accountId });
    });
  }

  // Password-gated retry for an account whose initial shielded-meta
  // derivation (KeyringHd.zcashDeriveAndSaveAccountMeta, run once during
  // account creation) never completed -- see zcashGetWalletAccount's error
  // below for why there's no automatic recovery otherwise. Only ever called
  // on a full (account-bound) vault, which always has a keyring. The capability
  // above runs on the chain-only vault for background sync/GC and must not
  // assume one.
  async zcashRetryLocalWalletSetup({
    password,
    deviceParams,
  }: {
    password?: string;
    deviceParams?: IDeviceSharedCallParams;
  }): Promise<void> {
    if (this.keyring instanceof KeyringHardware) {
      await this.keyring.retryLocalWalletSetup({
        deviceParams: checkIsDefined(deviceParams),
      });
      return;
    }
    await (this.keyring as KeyringHd).retryLocalWalletSetup({
      password: checkIsDefined(password),
    });
  }

  private async zcashTryAutoRepairLocalWalletSetupIfUnlocked(): Promise<boolean> {
    // A hardware account needs the device in hand; never auto-prompt for it.
    if (this.keyring instanceof KeyringHardware) {
      return false;
    }
    const hasCachedPassword =
      await this.backgroundApi.servicePassword.hasCachedPassword();
    if (!hasCachedPassword) {
      return false;
    }
    try {
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
          accountId: this.accountId,
          reason: EReasonForNeedPassword.CreateTransaction,
        });
      await this.zcashRetryLocalWalletSetup({ password });
      return true;
    } catch (e) {
      console.error('[zcash] auto repair local wallet setup failed', {
        accountId: this.accountId,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }

  async getLocalWalletAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    return this.zcashGetAccountMeta({ accountId });
  }

  // Powers the TokenDetails pool-breakdown block. Reached through
  // ServiceZcash.getLocalWalletBalance -> vaultFactory.
  // getChainOnlyVault({networkId}), which always constructs the vault with
  // accountId: '' (VaultFactory.ts) -- so this.accountId cannot be used
  // here (that bug shipped once already; zcashGetBalanceSafe/
  // zcashTriggerBackgroundSync are correctly `this.accountId`-based, but
  // only because their callers always go through the full, account-bound
  // getVault path instead). Same reasoning as getLocalWalletAccountMeta
  // right above, which was already correct. No auto-repair here (unlike
  // zcashGetBalanceSafe) -- the chain-only vault has no keyring/password to
  // repair with.
  // Send-flow pool picker (docs/08 send matrix): one pool per send, Ironwood
  // by default, Orchard and transparent only when chosen. Transparent mode
  // has a single pool and no picker.
  async listLocalWalletSendPools({
    accountId,
    toAddress,
  }: {
    accountId: string;
    toAddress?: string;
  }): Promise<ILocalWalletSendPool[] | undefined> {
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return undefined;
    }
    const balance = await this.getLocalWalletBalance({ accountId });
    if (!balance) {
      throw zcashTransparentError(
        'NOT_SYNCED',
        'Zcash spendable balance is unavailable. Refresh before sending.',
      );
    }
    const spendTransparent = shouldPreferTransparentForShieldedSend({
      enabled:
        privacyModeState.preferTransparentForShieldedSends === true &&
        privacyModeState.operation === undefined,
      toAddress: toAddress ?? '',
    });
    // Transparent spendable comes from the indexer's UTXO set (the same
    // input the transparent builder selects from), never from the runtime.
    let transparentSpendable = '0';
    let transparentTotal = '0';
    try {
      const dbAccount = (await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      })) as IDBUtxoAccount;
      const indexer = await this.zcashGetIndexerTransparentBalance({
        account: dbAccount,
      });
      transparentSpendable = indexer.spendable.toFixed(0);
      transparentTotal = indexer.total.toFixed(0);
    } catch (e) {
      console.error('[zcash] transparent send pool balance failed', {
        ...zcashDescribeError(e),
      });
    }
    const toParsed = (value: string) =>
      new BigNumber(value).shiftedBy(-ZCASH_DECIMALS).toFixed();
    const pool = (
      key: 'transparent' | IZcashSpendSource,
      label: string,
      spendable: string,
      isDefault?: boolean,
      total?: string,
      eligible?: boolean,
    ): ILocalWalletSendPool => ({
      key,
      label,
      spendable,
      spendableParsed: toParsed(spendable),
      isDefault,
      ...(eligible === undefined ? {} : { eligible }),
      ...(total === undefined ? {} : { total, totalParsed: toParsed(total) }),
    });
    // The transparent builder only pays transparent recipients; shielded
    // inputs can pay either address kind. A transparent recipient defaults
    // to the transparent pool, everything else to the current shielded pool.
    const transparentRecipient = !!toAddress && !isShieldedAddress(toAddress);
    const shieldedDefault = (key: IZcashSpendSource) =>
      !transparentRecipient && ZCASH_CURRENT_SHIELDED_POOL === key;
    return [
      pool(
        'ironwood',
        'Ironwood',
        getZcashSendSpendable(balance, 'ironwood', spendTransparent).toFixed(0),
        shieldedDefault('ironwood'),
      ),
      pool(
        'orchard',
        'Orchard',
        getZcashSendSpendable(balance, 'orchard', spendTransparent).toFixed(0),
        shieldedDefault('orchard'),
      ),
      pool(
        'transparent',
        'Transparent',
        transparentSpendable,
        transparentRecipient,
        transparentTotal,
        !toAddress || transparentRecipient,
      ),
    ];
  }

  // Pool balances in the chain-agnostic shape the token page renders. Hints
  // and move thresholds are chain rules, so they are decided here.
  async getLocalWalletAccountBalance({
    accountId,
  }: {
    accountId: string;
  }): Promise<ILocalWalletAccountBalance | null> {
    const balance = await this.getLocalWalletBalance({ accountId });
    if (!balance) {
      return null;
    }
    let sendPools: ILocalWalletSendPool[] | undefined;
    try {
      sendPools = await this.listLocalWalletSendPools({ accountId });
    } catch (e) {
      console.error('[zcash] transparent pool balance failed', {
        ...zcashDescribeError(e),
      });
    }
    const transparentPool = sendPools?.find(
      (pool) => pool.key === 'transparent',
    );
    const zat = (value: string | undefined) => new BigNumber(value ?? '0');
    const parsed = (value: string | undefined) =>
      zat(value).shiftedBy(-ZCASH_DECIMALS).toFixed();
    const breakdownHints = (detail: IZcashPoolDetail): string[] => {
      const hints: string[] = [];
      const maturing = zat(detail.pendingChange).plus(detail.pendingSpendable);
      if (maturing.gt(0)) {
        hints.push(`${parsed(maturing.toFixed())} maturing`);
      }
      if (zat(detail.locked).gt(0)) {
        hints.push(`${parsed(detail.locked)} locked by a pending send`);
      }
      return hints;
    };

    const transparentSpendable = zat(transparentPool?.spendable);
    const transparentTotal = zat(
      transparentPool?.total ?? transparentPool?.spendable,
    );
    const transparentHints: string[] = [];
    if (zat(balance.transparentCoinbaseBalance).gt(0)) {
      transparentHints.push(
        `${parsed(
          balance.transparentCoinbaseBalance,
        )} mining coinbase (cannot be shielded here)`,
      );
    }
    if (transparentTotal.minus(transparentSpendable).gt(0)) {
      transparentHints.push(
        `${parsed(transparentTotal.minus(transparentSpendable).toFixed())} confirming`,
      );
    }
    const privatePool = (
      key: IZcashSpendSource,
      total: string,
      detail: IZcashPoolDetail,
      extraHints: string[],
    ): ILocalWalletPoolBalance => ({
      key,
      total,
      totalParsed: parsed(total),
      spendable: detail.spendable,
      spendableParsed: parsed(detail.spendable),
      hints: [...extraHints, ...breakdownHints(detail)],
      move: {
        type: 'withdraw',
        amountParsed: zat(detail.spendable).gt(0)
          ? parsed(detail.spendable)
          : undefined,
        enabled: zat(detail.spendable).gt(0),
      },
    });
    return {
      total: balance.total,
      totalParsed: parsed(balance.total),
      spendable: balance.spendable,
      pools: [
        {
          key: 'transparent',
          total: transparentTotal.toFixed(0),
          totalParsed: parsed(transparentTotal.toFixed(0)),
          spendable: transparentSpendable.toFixed(0),
          spendableParsed: parsed(transparentSpendable.toFixed(0)),
          hints: transparentHints,
          move: {
            type: 'shield',
            amountParsed: transparentSpendable.gt(0)
              ? parsed(transparentSpendable.toFixed(0))
              : undefined,
            // Dust below the threshold is rejected by the sweep proposer.
            enabled: transparentSpendable.gte(ZCASH_SHIELDING_THRESHOLD_ZAT),
          },
        },
        privatePool(
          'ironwood',
          balance.ironwoodBalance,
          balance.poolsDetail.ironwood,
          [],
        ),
        privatePool(
          'orchard',
          balance.orchardBalance,
          balance.poolsDetail.orchard,
          ['Legacy pool — no longer receives funds.'],
        ),
      ],
    };
  }

  async getLocalWalletBalance({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashBalance | null> {
    try {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      return await api.getBalance(account);
    } catch (e) {
      console.log('[zcash] getLocalWalletBalance failed', {
        accountId,
        ...zcashDescribeError(e),
      });
      return null;
    }
  }

  // Powers the TokenDetails sync-progress display. This only reads the wallet
  // summary; polling status must never enqueue or join a scan job.
  async getLocalWalletSyncProgress({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashSyncProgress> {
    try {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      return await api.getSyncProgress(account);
    } catch (e) {
      console.log('[zcash] getLocalWalletSyncProgress failed', {
        accountId,
        ...zcashDescribeError(e),
      });
      return {
        birthdayHeight: null,
        backfillScannedHeight: null,
        backfillTargetHeight: null,
        backfillProgress: null,
        isBackfillComplete: false,
        tipScannedHeight: null,
        chainTip: null,
        tipLag: null,
        isTipCaughtUp: false,
        isSyncing: false,
      };
    }
  }

  private async applyPendingRescan({
    accountId,
    repair,
  }: {
    accountId: string;
    repair: IZcashPendingRescan;
  }): Promise<void> {
    const meta = await this.zcashGetAccountMeta({ accountId });
    if (!meta) {
      await this.backgroundApi.simpleDb.zcash.removePendingRescan({
        accountId,
      });
      return;
    }
    const lifecycleMutex = getZcashLifecycleMutex(meta.ufvk);
    await lifecycleMutex.runExclusive(async () => {
      await this.zcashAssertNoUnresolvedBroadcast(accountId);
      // Write the corrected birthday BEFORE purging. The purge builds its
      // wallet handle from whatever meta is stored right now, and every runtime
      // entry point lazily registers the account by fetching the treestate at
      // birthday-1. Purging first therefore means a bad stored birthday (e.g.
      // one above the chain tip, which lightwalletd rejects with "not in the
      // main chain") makes the purge itself fail -- the journal entry is never
      // consumed, the new birthday is never written, and the account is wedged
      // in a loop no amount of repairing can break. Saving first guarantees the
      // purge runs against a birthday that actually resolves. Crash safety is
      // unchanged: the caller wrote the journal before calling us, so a death
      // anywhere in here is replayed by zcashResumePendingRescans.
      await this.backgroundApi.simpleDb.zcash.saveAccountMeta({
        accountId,
        meta: {
          ...meta,
          birthdayHeight: repair.birthdayHeight,
          birthdaySource: repair.birthdaySource,
          birthdayTimestamp: repair.birthdayTimestamp,
        },
      });
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      await api.purgeWallet(account);
      await this.backgroundApi.simpleDb.zcash.removePendingRescan({
        accountId,
      });
    });
  }

  // Crash-safety replay for recorded birthday repairs; runs at the start of
  // every syncLocalWalletGroup turn (cheap when no journals exist).
  private async zcashResumePendingRescans(): Promise<void> {
    const repairs =
      await this.backgroundApi.simpleDb.zcash.listPendingRescans();
    for (const { accountId, repair } of repairs) {
      // eslint-disable-next-line no-await-in-loop
      const owner = await this.backgroundApi.serviceAccount.getDBAccountSafe({
        accountId,
      });
      if (!owner) {
        // eslint-disable-next-line no-await-in-loop
        await this.backgroundApi.simpleDb.zcash.removePendingRescan({
          accountId,
        });
        // eslint-disable-next-line no-continue
        continue;
      }
      // Runtime purge owns the active reservation/outgoing guard. If it is
      // busy, applyPendingRescan throws and this journal remains for retry.
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.applyPendingRescan({ accountId, repair });
      } catch (e) {
        // Keep the journal intact. A later scheduler tick can retry without
        // requiring the user to reopen the repair dialog.
        console.error('[zcash] pending rescan resume failed', {
          accountId,
          ...zcashDescribeError(e),
        });
      }
    }
  }

  // Shared primitive behind every birthday-repair entry point. The durable
  // journal is written before the cache purge, so a process death cannot
  // leave the new birthday half-applied.
  private async zcashRescanFromHeight({
    accountId,
    birthdayHeight,
    birthdaySource,
    birthdayTimestamp,
  }: {
    accountId: string;
    birthdayHeight: number;
    birthdaySource: IZcashBirthdaySource;
    birthdayTimestamp?: number;
  }): Promise<void> {
    const meta = await this.zcashGetAccountMeta({ accountId });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: no local wallet meta to rescan (run retryLocalWalletSetup first)',
      );
    }
    // A birthday ABOVE the chain tip wedges the account permanently: account
    // registration fetches the treestate at birthday-1, and lightwalletd
    // answers "the requested block is not in the main chain" for a height
    // that does not exist yet, so every balance/sync call fails forever with
    // no way back except another repair. The UI height field only validates
    // "positive safe integer", so a mistyped future height reaches here --
    // clamp centrally, where every repair entry point passes through.
    // Best-effort: if the tip cannot be fetched, keep the caller's value
    // rather than blocking the repair.
    let ceiling: number | undefined;
    try {
      const api = await this.zcashGetApi();
      const tip = await api.getChainTip({
        network: ZCASH_NETWORK_MAIN,
        lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
      });
      ceiling = tip ?? undefined;
    } catch (e) {
      console.log('[zcash] rescan tip clamp skipped (tip fetch failed)', {
        accountId,
        ...zcashDescribeError(e),
      });
    }
    const effectiveHeight = clampZcashBirthdayHeight({
      birthdayHeight,
      chainTip: ceiling,
    });
    if (ceiling !== undefined && birthdayHeight > ceiling) {
      console.log('[zcash] rescan birthday clamped to chain tip', {
        accountId,
        requested: birthdayHeight,
        chainTip: ceiling,
      });
    }
    const repair: IZcashPendingRescan = {
      birthdayHeight: effectiveHeight,
      birthdaySource,
      birthdayTimestamp,
      requestedAt: Date.now(),
    };
    await this.backgroundApi.simpleDb.zcash.savePendingRescan({
      accountId,
      repair,
    });
    await this.applyPendingRescan({ accountId, repair });
    console.log('[zcash] rescanFromHeight', { accountId, birthdayHeight });
  }

  // Implements the capability's rescan method. Resolves the scan start from
  // whichever form the caller has, then clamps/persists/applies via
  // zcashRescanFromHeight; a timestamp-derived start also persists the
  // original timestamp so the chosen recovery month stays explainable.
  async rescanLocalWallet({
    accountId,
    from,
    dryRun,
  }: {
    accountId: string;
    from: IRescanLocalWalletFrom;
    dryRun?: boolean;
  }): Promise<{ fromHeight: number }> {
    let birthdayHeight: number;
    let birthdaySource: IZcashBirthdaySource = 'manual-height';
    let birthdayTimestamp: number | undefined;
    if (from.type === 'height') {
      birthdayHeight = from.height;
    } else {
      birthdayTimestamp =
        from.type === 'timestamp'
          ? from.timestamp
          : Date.now() - Math.max(0, from.daysAgo) * 24 * 60 * 60 * 1000;
      birthdaySource = 'manual-month';
      const api = await this.zcashGetApi();
      const tip = await api.getChainTip({
        network: ZCASH_NETWORK_MAIN,
        lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
      });
      if (!tip) {
        throw new OneKeyLocalError(
          'zcash: could not fetch chain tip to rescan',
        );
      }
      birthdayHeight = estimateZcashBirthdayHeight({
        birthdayTimestamp,
        now: Date.now(),
        chainTip: tip,
      });
    }
    if (!dryRun) {
      await this.zcashRescanFromHeight({
        accountId,
        birthdayHeight,
        birthdaySource,
        birthdayTimestamp,
      });
    }
    return { fromHeight: birthdayHeight };
  }

  // ------------------------------------------------------------ balance

  async zcashGetBalanceSafe(): Promise<IZcashBalance | null> {
    // A chain-only vault carries accountId '' (VaultFactory), and the token
    // list briefly asks for balances while the UI is still settling on an
    // account. Neither can produce a balance, but falling through would log
    // "meta missing" on every poll and -- worse -- hand accountId '' to the
    // auto-repair path, which asks servicePassword to verify against an
    // account that does not exist. Nothing to do here but bail.
    if (!this.accountId) {
      return null;
    }
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId: this.accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return null;
    }
    try {
      const account = await this.zcashGetWalletAccount({
        accountId: this.accountId,
      });
      const api = await this.zcashGetApi();
      return await api.getBalance(account);
    } catch (e) {
      // Missing shielded meta from a dropped derivation call at account
      // creation is the one failure worth self-healing here -- every other
      // fetchAccountDetails trigger (periodic poll, app foreground, the
      // manual refresh button) lands in this same catch, so this is the one
      // place that needs to try, instead of every caller special-casing it.
      // Silent no-op if the wallet isn't unlocked (see
      // tryAutoRepairLocalWalletSetupIfUnlocked) -- the account just stays
      // transparent-only-looking until an explicit unlock happens.
      const repaired =
        await this.zcashTryAutoRepairLocalWalletSetupIfUnlocked();
      if (repaired) {
        try {
          const account = await this.zcashGetWalletAccount({
            accountId: this.accountId,
          });
          const api = await this.zcashGetApi();
          return await api.getBalance(account);
        } catch (e2) {
          console.log('[zcash] getBalance still failing after auto repair', {
            accountId: this.accountId,
            ...zcashDescribeError(e2),
          });
          throw e2;
        }
      }
      console.log('[zcash] getBalance skipped', {
        accountId: this.accountId,
        ...zcashDescribeError(e),
      });
      // Never-initialized is a STATE, not a fault: setup didn't complete (and
      // auto-repair couldn't run because the wallet is locked), so there is no
      // cached balance to protect and nothing transient to wait out. Report
      // zero so the token list and details page still open -- the details page
      // is where the Repair button that fixes this lives, and throwing here
      // locked the key inside the room (real device, 2026-08-27).
      if (isZcashSetupIncompleteError(e)) {
        return null;
      }
      // Everything else rethrows rather than degrading to null: callers turn
      // null into a literal "0", so a transient carrier/wasm hiccup would
      // overwrite the user's real balance on the home screen until the next
      // poll. Throwing matches every other chain's fetch* failure semantics --
      // upstream keeps the cached figure.
      throw e;
    }
  }

  override async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId: params.accountId || this.accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return super.fetchAccountDetails(params);
    }
    let serverResponse: IFetchServerAccountDetailsResponse | undefined;
    try {
      serverResponse = await super.fetchAccountDetails(params);
    } catch (e) {
      console.error('[zcash] backend account details fetch failed', {
        ...zcashDescribeError(e),
      });
    }
    const balance = await this.zcashGetComposedBalanceSafe(
      serverResponse?.data.data.balance,
    );
    if (!balance && serverResponse) {
      return serverResponse;
    }
    const total = balance?.total ?? '0';
    return {
      data: {
        data: {
          ...serverResponse?.data.data,
          address: params.accountAddress,
          balance: total,
          balanceParsed: new BigNumber(total)
            .shiftedBy(-ZCASH_DECIMALS)
            .toFixed(),
        },
      },
    };
  }

  override async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId: params.accountId || this.accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return super.fetchTokenList(params);
    }
    const network = await this.getNetwork();
    let serverResponse: IFetchServerTokenListResponse | undefined;
    try {
      serverResponse = await super.fetchTokenList(params);
    } catch (e) {
      console.error('[zcash] backend token list fetch failed', {
        ...zcashDescribeError(e),
      });
    }

    const serverNativeToken = serverResponse?.data.data.tokens.data.find(
      (token) => token.isNative || token.address === '',
    );
    const serverNativeFiat = serverNativeToken
      ? serverResponse?.data.data.tokens.map[serverNativeToken.$key]
      : undefined;
    const balance = await this.zcashGetComposedBalanceSafe(
      serverNativeFiat?.balance,
    );
    if (!balance && serverResponse) {
      return serverResponse;
    }
    const total = balance?.total ?? '0';
    const balanceParsed = new BigNumber(total)
      .shiftedBy(-ZCASH_DECIMALS)
      .toFixed();

    if (
      serverResponse &&
      balance &&
      applyZcashBalanceToBackendTokenList({
        response: serverResponse,
        balance,
        decimals: ZCASH_DECIMALS,
      })
    ) {
      return serverResponse;
    }

    const { networkId, accountAddress, xpub } = params.requestApiParams;
    const key = `${networkId}_${xpub ?? accountAddress}_`;
    const map: Record<string, ITokenFiat> = {
      [key]: {
        price: 0,
        price24h: 0,
        balance: total,
        balanceParsed,
        fiatValue: '0',
      },
    };
    const data = [
      {
        '$key': key,
        'decimals': network.decimals,
        'name': network.name,
        'symbol': network.symbol,
        'address': '',
        'logoURI': network.logoURI,
        'isNative': true,
      },
    ];
    const tokens: ITokenData = {
      data,
      map,
      keys: md5(
        `${networkId}__${
          isEmpty(map) ? '' : Object.keys(map).join(',')
        }__${JSON.stringify(data)}`,
      ),
      fiatValue: undefined,
    };
    const emptyTokenData = (): ITokenData => ({
      data: [],
      map: {},
      keys: md5(`${networkId}__empty`),
      fiatValue: undefined,
    });
    return {
      data: {
        data: {
          tokens,
          riskTokens: emptyTokenData(),
          smallBalanceTokens: emptyTokenData(),
        },
      },
    };
  }

  // The only transparent balance source: indexer total, and the eligible
  // regular UTXO sum as spendable. The runtime is never consulted for it.
  private async zcashGetIndexerTransparentBalance({
    account,
  }: {
    account: IDBUtxoAccount;
  }): Promise<{ total: BigNumber; spendable: BigNumber }> {
    const fresh = await this.zcashFetchFreshTransparentUtxos({ account });
    const spendable = fresh.utxos.reduce(
      (sum, utxo) => sum.plus(utxo.valueZat),
      new BigNumber(0),
    );
    let total = spendable;
    try {
      const response = await super.fetchTokenDetails({
        accountId: account.id,
        networkId: this.networkId,
        contractList: [''],
      });
      const nativeToken = response.data.data.find(
        (token) => token.info.isNative || token.info.address === '',
      );
      const indexerTotal = new BigNumber(nativeToken?.balance ?? '');
      if (indexerTotal.isFinite()) {
        total = BigNumber.max(indexerTotal, spendable);
      }
    } catch (e) {
      console.error('[zcash] indexer transparent total failed', {
        ...zcashDescribeError(e),
      });
    }
    return { total, spendable };
  }

  // Transparent mode: the indexer balance counts every confirmation, but the
  // builder only spends regular UTXOs past the trusted/untrusted thresholds.
  // Report that eligible sum as spendable so Max asks for what can be signed.
  private async zcashFetchTransparentTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const serverResponse = await super.fetchTokenDetails(params);
    const nativeToken = serverResponse.data.data.find(
      (token) => token.info.isNative || token.info.address === '',
    );
    if (!nativeToken) {
      return serverResponse;
    }
    let spendable: BigNumber;
    try {
      const fresh = await this.zcashFetchFreshTransparentUtxos();
      spendable = fresh.utxos.reduce(
        (sum, utxo) => sum.plus(utxo.valueZat),
        new BigNumber(0),
      );
    } catch (e) {
      console.error('[zcash] transparent spendable fetch failed', {
        ...zcashDescribeError(e),
      });
      return serverResponse;
    }
    const total = new BigNumber(nativeToken.balance ?? '0');
    if (!total.isFinite() || spendable.gt(total)) {
      return serverResponse;
    }
    applyZcashBalanceToBackendTokenDetails({
      response: serverResponse,
      balance: {
        total: total.toFixed(0),
        spendable: spendable.toFixed(0),
        frozen: total.minus(spendable).toFixed(0),
        publicSideSource: 'indexer',
      },
      decimals: ZCASH_DECIMALS,
    });
    return serverResponse;
  }

  // Send-flow balance source (SendDataInput -> fetchTokensDetails). The
  // backend supplies the transparent side and pricing; the runtime supplies
  // every shielded pool plus the authoritative spendable figure.
  override async fetchTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId: params.accountId || this.accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return this.zcashFetchTransparentTokenDetails(params);
    }
    const network = await this.getNetwork();
    let serverResponse: IFetchServerTokenDetailResponse | undefined;
    try {
      serverResponse = await super.fetchTokenDetails(params);
    } catch (e) {
      console.error('[zcash] backend token details fetch failed', {
        ...zcashDescribeError(e),
      });
    }
    const serverNativeToken = serverResponse?.data.data.find(
      (token) => token.info.isNative || token.info.address === '',
    );
    const balance = await privacyChainPerfSpan(
      'bg token details balance',
      () => this.zcashGetComposedBalanceSafe(serverNativeToken?.balance),
      (res) => ({ hasBalance: !!res }),
    );
    if (!balance && serverResponse) {
      return serverResponse;
    }
    const total = new BigNumber(balance?.total ?? '0');
    // `spendable` comes from the SDK, which computes it next to the constant
    // that decides what a proposal will accept. Recomputing it here is how the
    // two drift: this used to subtract only sapling and pending from the total,
    // so the transparent balance counted as spendable even though a transfer
    // never draws on it -- "max" then proposed an amount the same code refused.
    //
    // Both figures now arrive already reconciled from
    // composePrivacyChainBalance; frozen is total-minus-spendable there, which
    // is also where indexer-ahead-of-scan transparent value shows up.
    const spendable = new BigNumber(balance?.spendable ?? '0');
    const frozen = new BigNumber(balance?.frozen ?? '0');
    const toParsed = (v: BigNumber) => v.shiftedBy(-ZCASH_DECIMALS).toFixed();
    const totalParsed = toParsed(total);
    if (
      serverResponse &&
      balance &&
      applyZcashBalanceToBackendTokenDetails({
        response: serverResponse,
        balance,
        decimals: ZCASH_DECIMALS,
      })
    ) {
      return serverResponse;
    }
    const spendableFiatValue = '0';
    const frozenFiatValue = '0';
    const totalFiatValue = '0';
    return {
      data: {
        data: [
          {
            info: {
              decimals: network.decimals,
              name: network.name,
              symbol: network.symbol,
              address: '',
              logoURI: network.logoURI,
              isNative: true,
            },
            price: 0,
            price24h: 0,
            balance: spendable.toFixed(),
            balanceParsed: toParsed(spendable),
            frozenBalance: frozen.toFixed(),
            frozenBalanceParsed: toParsed(frozen),
            totalBalance: total.toFixed(),
            totalBalanceParsed: totalParsed,
            fiatValue: spendableFiatValue,
            frozenBalanceFiatValue: frozenFiatValue,
            totalBalanceFiatValue: totalFiatValue,
          },
        ],
      },
    };
  }

  // ------------------------------------------------------------ history

  // The runtime owns shielded history and locally-created transactions. The
  // OneKey backend owns transparent history. A runtime row wins a txid
  // collision so private metadata and locally-observed status are preserved.
  // Indexer detail for a transparent-only view; the shielded counterparty is
  // labeled the same way the list labels it.
  private async zcashFetchBackendHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const response = await super.fetchAccountHistoryDetail(params);
    const detail = response.data.data.data;
    if (detail) {
      response.data.data.data = normalizeZcashBackendHistoryTx(detail);
    }
    return response;
  }

  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const accountId = params.accountId || this.accountId;
    if (!accountId) {
      throw new OneKeyLocalError('zcash: history detail needs an account');
    }
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId,
      });
    if (privacyModeState.intent !== 'on') {
      return this.zcashFetchBackendHistoryDetail(params);
    }
    // Transparent history is backend-only: whenever the indexer knows this
    // txid, its detail is the detail. The runtime is consulted only for a
    // purely shielded transaction the indexer cannot see.
    try {
      const backendDetail = await this.zcashFetchBackendHistoryDetail(params);
      if (backendDetail.data.data.data?.tx) {
        privacyChainPerfLog('bg history detail', { source: 'backend' });
        return backendDetail;
      }
    } catch (e) {
      privacyChainPerfLog('bg history detail', {
        source: 'runtime',
        reason: 'backend-miss',
        message: e instanceof Error ? e.message : String(e),
      });
    }
    let item: IZcashHistoryItem | null;
    let details: IZcashTxDetails;
    try {
      const account = await this.zcashGetWalletAccount({ accountId });
      const api = await this.zcashGetApi();
      item = await findZcashLocalHistoryItem({
        txid: params.txid,
        fetchPage: (pagination) => api.getHistory(account, pagination),
      });
      if (!item) {
        throw new OneKeyLocalError('zcash: transaction not found');
      }
      // Account-view inputs & outputs from the local note tables: our
      // consumed notes/UTXOs, our created notes/UTXOs, and (for our own
      // sends) external outputs with their real recipient addresses.
      // Shielded entries have no on-chain address, so they are labeled by
      // pool instead.
      details = await api.getTxDetails(account, { txid: params.txid });
    } catch (e) {
      console.error('[zcash] runtime history detail failed', {
        txid: params.txid,
        ...zcashDescribeError(e),
      });
      throw e;
    }
    privacyChainPerfLog('bg history detail', {
      source: 'runtime',
      spent: details.spent.length,
      received: details.received.length,
      external: details.external.length,
    });
    let status = EOnChainHistoryTxStatus.Pending;
    if (item.expired) {
      status = EOnChainHistoryTxStatus.Failed;
    } else if (!item.pending && item.minedHeight !== null) {
      status = EOnChainHistoryTxStatus.Success;
    }

    const poolLabel = (pool: string) =>
      `${pool.charAt(0).toUpperCase()}${pool.slice(1)} pool`;
    const toZec = (value: string) =>
      new BigNumber(value).shiftedBy(-ZCASH_DECIMALS).toFixed();
    const sends: IOnChainHistoryTx['sends'] = details.spent.map((s) => {
      const isShielded = s.pool !== 'transparent';
      const label = isShielded ? poolLabel(s.pool) : '';
      return {
        type: isShielded
          ? EOnChainHistoryTransferType.Shielded
          : EOnChainHistoryTransferType.Transfer,
        address: isShielded ? label : (s.address ?? ''),
        from: isShielded ? '' : (s.address ?? ''),
        to: '',
        token: '',
        key: '',
        amount: toZec(s.value),
        label,
        isNative: true,
        isOwn: true,
      };
    });
    const receives: IOnChainHistoryTx['receives'] = [
      ...details.external.map((e) => ({
        type: EOnChainHistoryTransferType.Transfer,
        address: e.address,
        from: '',
        to: e.address,
        token: '',
        key: '',
        amount: toZec(e.value),
        label: '',
        isNative: true,
        isOwn: false,
      })),
      // Change never leaves the account; listing it reads as a second
      // recipient. Both reference wallets omit it.
      ...details.received
        .filter((r) => !r.internal)
        .map((r) => {
          const isShielded = r.pool !== 'transparent';
          const label = isShielded ? poolLabel(r.pool) : '';
          return {
            type: isShielded
              ? EOnChainHistoryTransferType.Shielded
              : EOnChainHistoryTransferType.Transfer,
            address: isShielded ? label : (r.address ?? ''),
            from: '',
            to: isShielded ? '' : (r.address ?? ''),
            token: '',
            key: '',
            amount: toZec(r.value),
            label,
            isNative: true,
            isOwn: true,
          };
        }),
    ];

    // Decrypted text memos on notes this account RECEIVED (the runtime
    // already filters empty/protocol-reserved memo bytes). Usually one.
    const memos = details.received
      .map((r) => r.memo)
      .filter((m): m is string => !!m);

    return {
      data: {
        data: {
          // Status consumers read `tx`/`status` (ServiceHistory pending match
          // + fixConfirmedTxStatus); the UTXO details page reads
          // `sends`/`receives`/`memo`; list display keeps coming from
          // fetchAccountHistoryFromLocal.
          data: {
            tx: item.txid,
            status,
            sends,
            receives,
            memo: memos.length ? memos.join('\n') : undefined,
          } as IOnChainHistoryTx,
          tokens: {},
          nfts: {},
        },
      },
    };
  }

  // MUST always return an array, never undefined.
  //
  // ServiceHistory treats a defined result as a replacement for the server
  // query, so this method owns the whole set -- shielded from the local scan,
  // transparent from the indexer, merged here. Returning undefined would fall
  // through to the server, which reports transparent rows only, and
  // `localWallet.historySource` would then let the reconciler delete
  // every shielded row as "no longer reported". Errors degrade to the cached
  // set instead (see the catch below).
  override async fetchAccountHistoryFromLocal(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<IAccountHistoryTx[] | undefined> {
    // honor the explicit param; this.accountId is '' on a chain-only vault
    const accountId = params.accountId || this.accountId;
    let items: IZcashHistoryItem[];
    let historySnapshotIsComplete = true;
    const loadCachedHistory = async () => {
      const [confirmed, pending] = await Promise.all([
        this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryConfirmedTxs(
          {
            networkId: params.networkId,
            accountAddress: params.accountAddress,
            xpub: params.xpub,
          },
        ),
        this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryPendingTxs(
          {
            networkId: params.networkId,
            accountAddress: params.accountAddress,
            xpub: params.xpub,
          },
        ),
      ]);
      return [...confirmed, ...pending];
    };
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId,
      });
    if (privacyModeState.intent === 'on') {
      try {
        const account = await this.zcashGetWalletAccount({ accountId });
        const api = await this.zcashGetApi();
        const maxItems = 20_000;
        // One wallet read-lock gives reconciliation a coherent snapshot. The
        // extra row distinguishes "complete at exactly maxItems" from a
        // truncated result without a second read racing the scanner.
        items = await privacyChainPerfSpan(
          'bg history runtime read',
          () =>
            api.getHistory(account, {
              limit: maxItems + 1,
              offset: 0,
            }),
          (rows) => ({ rows: rows.length }),
        );
        historySnapshotIsComplete = items.length <= maxItems;
        if (!historySnapshotIsComplete) {
          items = items.slice(0, maxItems);
        }
        const progress = await api.getSyncProgress(account);
        historySnapshotIsComplete =
          historySnapshotIsComplete && progress.isBackfillComplete;
      } catch {
        // A transient scanner/carrier failure is not evidence that history is
        // empty. Preserve the last known cache and retry on the next refresh.
        return loadCachedHistory();
      }
    } else {
      // Transparent Mode must not initialize the wallet runtime. The backend
      // remains the only transaction source until the user enables privacy.
      items = [];
    }
    const account = await this.getAccount();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });
    const buildRows = (rows: IZcashHistoryItem[]) =>
      Promise.all(
        rows.map((item) =>
          buildZcashLocalHistoryTx({
            item,
            ownAddress: account.address,
            nativeToken,
            networkId: this.networkId,
            accountId: this.accountId,
            accountAddress: params.accountAddress,
            xpub: params.xpub,
            buildTransferAction: (p) => this.buildTxTransferAssetAction(p),
          }),
        ),
      );

    const privateTxs = await privacyChainPerfSpan(
      'bg history map private rows',
      () => buildRows(items),
      (rows) => ({ rows: rows.length }),
    );

    let publicSideFailed = false;
    let publicSnapshotIsComplete = false;
    let publicTxs: IAccountHistoryTx[] = [];
    try {
      const publicResult = await privacyChainPerfSpan(
        'bg history transparent fetch',
        () => this.zcashFetchTransparentHistory(params),
        (res) => ({ rows: res.txs.length }),
      );
      publicTxs = publicResult.txs;
      publicSnapshotIsComplete = publicResult.snapshotComplete;
    } catch (e) {
      publicSideFailed = true;
      console.error('[zcash] transparent history fetch failed', {
        name: e instanceof Error ? e.name : typeof e,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (!publicSideFailed) {
      const transparentPending =
        await this.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
          accountId,
        });
      const observedTxs = new Map(
        publicTxs.map((tx) => [
          tx.decodedTx.txid.toLowerCase(),
          tx.decodedTx.status,
        ]),
      );
      await Promise.all(
        transparentPending.flatMap((tx) => {
          const status = observedTxs.get(tx.txid.toLowerCase());
          if (status === undefined) {
            // Not seen by the backend yet. A tx whose broadcast outcome was
            // never confirmed is resubmitted; the same bytes are idempotent.
            return tx.broadcastState === 'unknown'
              ? [this.zcashReplayUnknownTransparentBroadcast({ accountId, tx })]
              : [];
          }
          if (isTerminalTransparentHistoryStatus(status)) {
            return [
              this.backgroundApi.simpleDb.zcash.settleTransparentPendingTx({
                accountId,
                txid: tx.txid,
              }),
            ];
          }
          if (tx.broadcastState === 'unknown') {
            return [
              this.backgroundApi.simpleDb.zcash.markTransparentPendingTxAccepted(
                {
                  accountId,
                  txid: tx.txid,
                },
              ),
            ];
          }
          return [];
        }),
      );
      // Keep the exact transparent projection before display merging promotes
      // a cross-pool transaction to `mixed`. The generic cache rejects that
      // mixed row by design, while this public shadow remains a safe fallback
      // if the private runtime is temporarily unavailable.
      try {
        await this.backgroundApi.simpleDb.localHistory.saveLocalHistoryTxs({
          networkId: params.networkId,
          accountAddress: params.accountAddress,
          xpub: params.xpub,
          pendingTxs: publicTxs.filter(
            (tx) => tx.decodedTx.status === EDecodedTxStatus.Pending,
          ),
          confirmedTxs: publicTxs.filter(
            (tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending,
          ),
        });
      } catch (e) {
        console.error('[zcash] transparent history cache failed', {
          name: e instanceof Error ? e.name : typeof e,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const txs = mergePrivacyChainHistoryTxs({ privateTxs, publicTxs });
    if (
      isPrivacyChainHistoryComplete({
        privateSideComplete: historySnapshotIsComplete,
        publicSideFailed: publicSideFailed || !publicSnapshotIsComplete,
      })
    ) {
      return txs;
    }

    // During birthday backfill the scanner is authoritative for rows it has
    // already rediscovered, but absence is not evidence yet. Merge the old
    // cache so the generic authoritative-history reconciler only adds/updates
    // now; once backfill and pagination are complete, the branch above lets it
    // remove stale rows in one deterministic pass.
    const cached = await loadCachedHistory();
    return appendMissingPrivacyChainHistoryTxs({
      currentTxs: txs,
      cachedTxs: cached,
    });
  }

  // One composed balance for every display surface, so the token list, the
  // account details and the send page cannot disagree about what the user has.
  //
  // Transparent value prefers the indexer (it answers in a second; the scan can
  // be hours behind), shielded can only come from the scan, and `spendable`
  // stays whatever the local wallet says -- the indexer never gets a vote on
  // what a proposal will accept.
  async zcashGetComposedBalanceSafe(
    publicSideBackend?: string,
  ): Promise<IPrivacyChainComposedBalance | null> {
    const balance = await this.zcashGetBalanceSafe();
    if (!balance) {
      return null;
    }
    return composePrivacyChainBalance({
      privateSide: balance.shielded,
      publicSideLocal: balance.transparent,
      publicSideIndexer: publicSideBackend,
      spendable: balance.spendable,
    });
  }

  // Zcash's public half: transparent transactions, from an indexer.
  //
  // The local scan covers transparent too, so this is never a second opinion
  // on the same row -- it is the same data arriving in a second instead of
  // after a full backfill. mergePrivacyChainHistoryTxs drops anything the scan
  // already reports.
  //
  // Throws on indexer failure: the caller needs to tell "nothing to add" apart
  // from "could not ask", since only the second one must block claiming a
  // complete snapshot.
  private async zcashFetchTransparentHistory(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<{
    txs: IAccountHistoryTx[];
    snapshotComplete: boolean;
  }> {
    const accountId = params.accountId || this.accountId;
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    const transparentAddress =
      meta?.transparentAddress || params.accountAddress;
    if (!transparentAddress) {
      return { txs: [], snapshotComplete: true };
    }
    const client = await this.backgroundApi.serviceHistory.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const headers = {
      ...(await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
        accountId,
      })),
      ...(await this.backgroundApi.serviceHistory.getOneKeyIdAuthHeaders()),
    };
    const dbAccountCache = {};
    return fetchCompleteZcashBackendHistory({
      fetchPage: async ({ limit, maxTimestampMs }) => {
        const response = await client.post<{
          data: IFetchAccountHistoryResp;
        }>(
          '/wallet/v1/account/history/list',
          {
            networkId: params.networkId,
            accountAddress: transparentAddress,
            xpub: params.xpub,
            tokenAddress: '',
            limit,
            ...(maxTimestampMs === undefined ? {} : { maxTimestampMs }),
          },
          { headers },
        );
        return response.data.data;
      },
      buildPage: async ({ page, indexOffset }) =>
        Promise.all(
          page.data.map((onChainHistoryTx, index) =>
            this.buildOnChainHistoryTx({
              dbAccountCache,
              accountId,
              networkId: params.networkId,
              accountAddress: params.accountAddress,
              xpub: params.xpub,
              onChainHistoryTx:
                normalizeZcashBackendHistoryTx(onChainHistoryTx),
              tokens: page.tokens,
              nfts: page.nfts,
              index: indexOffset + index,
            }),
          ),
        ),
    });
  }

  // ------------------------------------------------ transparent send

  private zcashTransparentAccountIndex(account: IDBUtxoAccount): number {
    const pathIndex = account.pathIndex;
    if (
      typeof pathIndex === 'number' &&
      Number.isSafeInteger(pathIndex) &&
      pathIndex >= 0
    ) {
      return pathIndex;
    }
    const pathMatch = /^m\/44'\/133'\/(\d+)'$/.exec(account.path);
    if (pathMatch) {
      return Number(pathMatch[1]);
    }
    const xpubAccountIndex = getZcashAccountIndexFromXpub(account.xpub);
    if (xpubAccountIndex !== null) return xpubAccountIndex;
    throw zcashTransparentError(
      'INVALID_DERIVATION_PATH',
      'Zcash transparent account path is unavailable',
    );
  }

  private zcashNormalizeTransparentPath({
    path,
    accountIndex,
  }: {
    path: string;
    accountIndex: number;
  }): { derivationPath: string; internal: boolean } | undefined {
    const derivationPath = path.startsWith('m/')
      ? path
      : `m/44'/133'/${accountIndex}'/${path.replace(/^\//, '')}`;
    const match = ZCASH_TRANSPARENT_PATH_RE.exec(derivationPath);
    if (!match || Number(match[1]) !== accountIndex) return undefined;
    return { derivationPath, internal: match[2] === '1' };
  }

  private async zcashFetchFreshTransparentUtxos(options?: {
    // Chain-only vault callers (capability methods) name the account.
    account?: IDBUtxoAccount;
  }): Promise<{
    account: IDBUtxoAccount;
    accountIndex: number;
    targetHeight: number;
    utxos: IZcashTransparentTxRequest['utxos'];
  }> {
    const account =
      options?.account ?? ((await this.getAccount()) as IDBUtxoAccount);
    const accountIndex = this.zcashTransparentAccountIndex(account);
    const response = await super.fetchAccountDetails({
      networkId: this.networkId,
      accountId: account.id,
      accountAddress: account.address,
      xpub: account.xpub,
      withUTXOList: true,
      withFrozenBalance: true,
      withUTXOBlockTime: true,
      withCheckInscription: false,
    });
    const serverUtxos =
      response.data.data.allUtxoList ?? response.data.data.utxoList;
    if (!serverUtxos) {
      throw zcashTransparentError(
        'UTXO_SOURCE_UNAVAILABLE',
        'Zcash transparent UTXOs are unavailable',
      );
    }

    let targetHeight = 0;
    const seen = new Set<string>();
    const utxos: IZcashTransparentTxRequest['utxos'] = [];
    for (const utxo of serverUtxos as IUtxoInfo[]) {
      if (
        !/^[0-9a-f]{64}$/i.test(utxo.txid) ||
        !Number.isSafeInteger(utxo.vout) ||
        utxo.vout < 0 ||
        !Number.isSafeInteger(utxo.height) ||
        utxo.height <= 0 ||
        !Number.isSafeInteger(utxo.confirmations) ||
        utxo.confirmations <= 0
      ) {
        // eslint-disable-next-line no-continue
        continue;
      }
      targetHeight = Math.max(
        targetHeight,
        utxo.height + utxo.confirmations - 1,
      );
      const key = `${utxo.txid.toLowerCase()}:${utxo.vout}`;
      if (seen.has(key)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      seen.add(key);

      let coinbase: boolean | undefined;
      if (typeof utxo.isCoinbase === 'boolean') {
        coinbase = utxo.isCoinbase;
      } else if (typeof utxo.txIndex === 'number') {
        coinbase = utxo.txIndex === 0;
      }
      const normalizedPath = this.zcashNormalizeTransparentPath({
        path: utxo.path,
        accountIndex,
      });
      const scriptPubKey =
        utxo.scriptPublicKey?.scriptPublicKey || utxo.prevOutPubkey;
      const confirmationsRequired = normalizedPath?.internal
        ? TRUSTED_CONFIRMATIONS
        : UNTRUSTED_CONFIRMATIONS;
      if (
        coinbase !== false ||
        !normalizedPath ||
        utxo.confirmations < confirmationsRequired ||
        !ZCASH_TRANSPARENT_P2PKH_SCRIPT_RE.test(scriptPubKey)
      ) {
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        if (BigInt(utxo.value) <= 0n) {
          // eslint-disable-next-line no-continue
          continue;
        }
      } catch {
        // eslint-disable-next-line no-continue
        continue;
      }
      utxos.push({
        txid: utxo.txid.toLowerCase(),
        vout: utxo.vout,
        valueZat: utxo.value,
        scriptPubKey: scriptPubKey.toLowerCase(),
        isCoinbase: false,
        confirmations: utxo.confirmations,
        derivationPath: normalizedPath.derivationPath,
      });
    }
    if (targetHeight <= 0) {
      throw zcashTransparentError(
        'CHAIN_HEIGHT_UNAVAILABLE',
        'Zcash chain height is unavailable from the UTXO source',
      );
    }
    return { account, accountIndex, targetHeight, utxos };
  }

  private async zcashTransparentChange({
    account,
    accountIndex,
  }: {
    account: IDBUtxoAccount;
    accountIndex: number;
  }): Promise<{ address: string; derivationPath: string }> {
    const relativePath = '1/0';
    const result = await getAddressFromXpub({
      curve: 'secp256k1',
      network: await this.getBtcForkNetwork(),
      xpub: account.xpub,
      relativePaths: [relativePath],
      addressEncoding: EAddressEncodings.P2PKH,
      encodeAddress: encodeZcashAddress,
    });
    const address = result.addresses[relativePath];
    if (!address?.startsWith('t1')) {
      throw zcashTransparentError(
        'INVALID_CHANGE_ADDRESS',
        'Unable to derive a Zcash transparent change address',
      );
    }
    return {
      address,
      derivationPath: `m/44'/133'/${accountIndex}'/${relativePath}`,
    };
  }

  private zcashTransparentRequest({
    accountIndex,
    targetHeight,
    utxos,
    selectedOutpoints,
    toAddress,
    amountZat,
    sendMax,
    change,
  }: {
    accountIndex: number;
    targetHeight: number;
    utxos: IZcashTransparentTxRequest['utxos'];
    selectedOutpoints: IZcashTransparentOutpoint[];
    toAddress: string;
    amountZat: string;
    sendMax: boolean;
    change?: IZcashTransparentTxRequest['change'];
  }): IZcashTransparentTxRequest {
    return {
      network: 'main',
      accountIndex,
      targetHeight,
      expiryHeight: targetHeight + TRANSPARENT_TX_EXPIRY_DELTA,
      utxos,
      selectedOutpoints,
      recipients: [
        sendMax ? { address: toAddress } : { address: toAddress, amountZat },
      ],
      sendMax,
      change: sendMax ? undefined : change,
    };
  }

  private async zcashBuildTransparentEncodedTx({
    transferInfo,
    sendMax,
  }: {
    transferInfo: NonNullable<IBuildEncodedTxParams['transfersInfo']>[number];
    sendMax: boolean;
  }): Promise<IEncodedTxZcash> {
    if (!/^t[13]/.test(transferInfo.to)) {
      throw zcashTransparentError(
        'UNSUPPORTED_TRANSPARENT_DESTINATION',
        'Transparent Mode supports only t1 and t3 recipients',
      );
    }
    const validation = await this.validateAddress(transferInfo.to);
    if (!validation.isValid) {
      throw zcashTransparentError(
        'INVALID_ADDRESS',
        'Invalid Zcash transparent address',
      );
    }
    const fresh = await this.zcashFetchFreshTransparentUtxos();
    await this.backgroundApi.simpleDb.zcash.pruneExpiredTransparentState({
      accountId: this.accountId,
      currentHeight: fresh.targetHeight,
    });
    await this.zcashAssertNoUnresolvedBroadcastWithLifecycleLock(
      this.accountId,
    );
    if (!fresh.utxos.length) {
      throw zcashTransparentError(
        'INSUFFICIENT_FUNDS',
        'No confirmed regular Zcash transparent UTXOs are spendable',
      );
    }
    const requestedAmountZat = new BigNumber(transferInfo.amount)
      .shiftedBy(ZCASH_DECIMALS)
      .toFixed(0, BigNumber.ROUND_DOWN);
    const selectedKeys = transferInfo.selectedUtxoKeys;
    let candidates = fresh.utxos;
    if (selectedKeys?.length) {
      const selectedSet = new Set(selectedKeys.map((key) => key.toLowerCase()));
      if (selectedSet.size !== selectedKeys.length) {
        throw zcashTransparentError(
          'INVALID_UTXO_SELECTION',
          'Duplicate Zcash transparent UTXO selection',
        );
      }
      candidates = fresh.utxos.filter((utxo) =>
        selectedSet.has(`${utxo.txid}:${utxo.vout}`),
      );
      if (candidates.length !== selectedSet.size) {
        throw zcashTransparentError(
          'UTXO_SELECTION_CHANGED',
          'A selected Zcash transparent UTXO is no longer spendable',
        );
      }
    } else {
      candidates = fresh.utxos.toSorted((left, right) =>
        new BigNumber(right.valueZat).comparedTo(left.valueZat),
      );
    }
    const candidateTotal = candidates.reduce(
      (sum, utxo) => sum.plus(utxo.valueZat),
      new BigNumber(0),
    );
    // Same rule as the BTC vault: asking for more than the confirmed regular
    // UTXOs can cover is an error, never a silent send-all.
    const requestedAmount = new BigNumber(requestedAmountZat);
    if (!sendMax && requestedAmount.gt(candidateTotal)) {
      throw zcashTransparentError(
        'INSUFFICIENT_FUNDS',
        'Insufficient confirmed Zcash transparent balance',
        {
          requestedZat: requestedAmount.toFixed(0),
          spendableZat: candidateTotal.toFixed(0),
        },
      );
    }
    const change = sendMax
      ? undefined
      : await this.zcashTransparentChange({
          account: fresh.account,
          accountIndex: fresh.accountIndex,
        });
    const api = await this.zcashGetApi();
    let request: IZcashTransparentTxRequest | undefined;
    let quote: IZcashTransparentTxQuote | undefined;
    let lastError: unknown;
    const attempts =
      selectedKeys?.length || sendMax
        ? [candidates]
        : candidates.map((_, index) => candidates.slice(0, index + 1));
    for (const selected of attempts) {
      const selectedOutpoints = selected.map(({ txid, vout }) => ({
        txid,
        vout,
      }));
      const candidateRequest = this.zcashTransparentRequest({
        accountIndex: fresh.accountIndex,
        targetHeight: fresh.targetHeight,
        utxos: fresh.utxos,
        selectedOutpoints,
        toAddress: transferInfo.to,
        amountZat: requestedAmountZat,
        sendMax,
        change,
      });
      try {
        // eslint-disable-next-line no-await-in-loop
        const candidateQuote = await api.quoteTransparentTx(candidateRequest);
        if (!sameOutpoints(candidateQuote.spentOutpoints, selectedOutpoints)) {
          throw zcashTransparentError(
            'UTXO_SELECTION_MISMATCH',
            'Zcash transparent signer changed the selected inputs',
          );
        }
        request = candidateRequest;
        quote = candidateQuote;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!request || !quote) {
      throw (
        lastError ??
        zcashTransparentError(
          'INSUFFICIENT_FUNDS',
          'Insufficient Zcash transparent balance',
        )
      );
    }
    const selectedUtxos = request.selectedOutpoints.map((outpoint) =>
      checkIsDefined(
        fresh.utxos.find(
          (utxo) => utxo.txid === outpoint.txid && utxo.vout === outpoint.vout,
        ),
      ),
    );
    return {
      inputs: selectedUtxos.map((utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.valueZat,
        address: '',
        path: utxo.derivationPath,
      })),
      outputs: [{ address: transferInfo.to, value: quote.sendAmountZat }],
      inputsForCoinSelect: [],
      outputsForCoinSelect: [],
      fee: quote.feeZat,
      txSize: undefined,
      zcashMode: 'transparent',
      zcashTo: transferInfo.to,
      zcashAmountValue: quote.sendAmountZat,
      zcashTransparentPlan: {
        ownerId: generateUUID(),
        accountIndex: fresh.accountIndex,
        sendMax,
        selectedOutpoints: request.selectedOutpoints,
        change,
      },
    };
  }

  async zcashPrepareFreshTransparentRequest({
    encodedTx,
  }: {
    encodedTx: IEncodedTxZcash;
  }): Promise<IZcashTransparentTxRequest> {
    const plan = encodedTx.zcashTransparentPlan;
    if (encodedTx.zcashMode !== 'transparent' || !plan) {
      throw zcashTransparentError(
        'INVALID_TRANSPARENT_PLAN',
        'Zcash transparent transaction plan is missing',
      );
    }
    const fresh = await this.zcashFetchFreshTransparentUtxos();
    await this.backgroundApi.simpleDb.zcash.pruneExpiredTransparentState({
      accountId: this.accountId,
      currentHeight: fresh.targetHeight,
    });
    await this.zcashAssertNoUnresolvedBroadcastWithLifecycleLock(
      this.accountId,
    );
    if (fresh.accountIndex !== plan.accountIndex) {
      throw zcashTransparentError(
        'ACCOUNT_CHANGED',
        'Zcash transparent signing account changed',
      );
    }
    const freshByOutpoint = new Map(
      fresh.utxos.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo]),
    );
    for (const outpoint of plan.selectedOutpoints) {
      if (!freshByOutpoint.has(`${outpoint.txid}:${outpoint.vout}`)) {
        throw zcashTransparentError(
          'UTXO_SELECTION_CHANGED',
          'A selected Zcash transparent UTXO is no longer spendable',
        );
      }
    }
    const request = this.zcashTransparentRequest({
      accountIndex: fresh.accountIndex,
      targetHeight: fresh.targetHeight,
      utxos: fresh.utxos,
      selectedOutpoints: plan.selectedOutpoints,
      toAddress: encodedTx.zcashTo,
      amountZat: encodedTx.zcashAmountValue,
      sendMax: plan.sendMax,
      change: plan.change,
    });
    const quote = await (await this.zcashGetApi()).quoteTransparentTx(request);
    if (
      quote.feeZat !== encodedTx.fee ||
      quote.sendAmountZat !== encodedTx.zcashAmountValue ||
      !sameOutpoints(quote.spentOutpoints, plan.selectedOutpoints)
    ) {
      throw zcashTransparentError(
        'FEE_CHANGED',
        'Zcash transparent transaction changed. Review it again.',
        {
          expectedFeeZat: encodedTx.fee,
          actualFeeZat: quote.feeZat,
        },
      );
    }
    return request;
  }

  // ------------------------------------------------------------ fee

  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const network = await this.getNetwork();
    // Exact ZIP-317 fee via the wasm proposer (note selection, no build).
    // Falls back to the flat conventional fee when the quote can't run
    // (insufficient funds, unsynced wallet, chain-only vault).
    let feeZatValue = ZCASH_DISPLAY_FEE_ZAT;
    const encodedTx = params.encodedTx as IEncodedTxZcash | undefined;
    if (encodedTx?.zcashMode === 'transparent' || encodedTx?.pcztHex) {
      // Fixed at build time: the transparent plan, or the locked PCZT's own
      // ZIP-317 fee. No quote can be more exact than the proposal itself.
      feeZatValue = encodedTx.fee;
    } else if (encodedTx?.isShielding && this.accountId) {
      try {
        const account = await this.zcashGetWalletAccount({
          accountId: this.accountId,
        });
        const { feeZat } = await (
          await this.zcashGetApi()
        ).quoteShieldFunds(account);
        feeZatValue = feeZat;
      } catch (e) {
        const runtime = readZcashRuntimeError(e);
        if (runtime?.code === 'INSUFFICIENT_FUNDS') {
          throw toUserFacingZcashError(e);
        }
        console.log(
          '[zcash] shielding fee quote failed, using conventional estimate',
          { ...zcashDescribeError(e) },
        );
      }
    } else if (
      encodedTx?.zcashTo &&
      encodedTx?.zcashAmountValue &&
      this.accountId
    ) {
      try {
        const account = await this.zcashGetWalletAccount({
          accountId: this.accountId,
        });
        const api = await this.zcashGetApi();
        const { feeZat } = await api.quotePczt(account, {
          toAddress: encodedTx.zcashTo,
          valueZat: encodedTx.zcashAmountValue,
          spendSource:
            encodedTx.zcashSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL,
          spendTransparent: encodedTx.zcashSpendTransparent,
        });
        feeZatValue = feeZat;
      } catch (e) {
        // Swallowing EVERY quote failure here was the "doomed send" bug: when
        // the quote itself said "this send is impossible" (insufficient
        // spendable, funds needing shielding, an invalid address), the user
        // saw a plausible flat fee, confirmed, typed the password, and only
        // THEN hit the error at pczt creation. User-actionable codes now
        // surface pre-confirm as the fee-line error; the flat-fee fallback
        // stays for transient states where quoting is expected to fail
        // (still syncing, offline, chain-only vault).
        const runtime = readZcashRuntimeError(e);
        const actionable = [
          'INSUFFICIENT_FUNDS',
          'FUNDS_NEED_SHIELDING',
          'COINBASE_FUNDS_UNSPENDABLE',
          'INVALID_ADDRESS',
          'AMOUNT_OUT_OF_RANGE',
          'INVALID_MEMO',
        ];
        if (runtime && actionable.includes(runtime.code)) {
          throw toUserFacingZcashError(e);
        }
        console.log('[zcash] fee quote failed, using conventional estimate', {
          ...zcashDescribeError(e),
        });
      }
    }
    return {
      data: {
        data: {
          isEIP1559: false,
          feeDecimals: network.feeMeta.decimals,
          feeSymbol: network.feeMeta.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
          // ZIP-317; exact when quoted, conventional otherwise. Not
          // user-editable. feeUtils consumes feeValue as an already-parsed
          // native-unit amount (ZEC), so shift out of zatoshis here.
          feeUTXO: [
            {
              feeValue: new BigNumber(feeZatValue)
                .shiftedBy(-ZCASH_DECIMALS)
                .toFixed(),
            },
          ],
        },
      },
    };
  }

  // ------------------------------------------------------------ send (PCZT)

  // BTC's precheck pulls a blockbook UTXO list (frozen-ordinals guard) that
  // zcash's local fetchAccountDetails never provides — it would throw and
  // permanently disable the Send button. PCZT spends have no ordinals concept.
  override async precheckUnsignedTx(): Promise<boolean> {
    return true;
  }

  // Defense in depth beside nativeBatchTransferEnabled:false — BTC's bulk-send
  // builder would emit coin-selected IEncodedTxBtc that bypasses the PCZT flow.
  override async buildBulkSendEncodedTxs(): Promise<never> {
    throw new OneKeyInternalError('Batch transfer is not supported');
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxZcash> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfer is not supported');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new OneKeyLocalError(
        'buildEncodedTx ERROR: transferInfo.to is missing',
      );
    }
    const privacyMode =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId: this.accountId,
      });
    const sourcePool = transferInfo.localWalletSourcePool;
    const requestedSpendSource = zcashSpendSourceFromKey(
      transferInfo.localWalletSpendSource,
    );
    const preferTransparentForShieldedSend =
      shouldPreferTransparentForShieldedSend({
        enabled:
          privacyMode.preferTransparentForShieldedSends === true &&
          privacyMode.intent === 'on' &&
          privacyMode.operation === undefined,
        toAddress: transferInfo.to,
      });
    if (
      privacyMode.intent !== 'on' &&
      (transferInfo.localWalletShield ||
        sourcePool === 'orchard' ||
        sourcePool === 'ironwood')
    ) {
      throw zcashTransparentError(
        'PRIVACY_MODE_DISABLED',
        'Enable Zcash Privacy Mode before using a shielded pool',
      );
    }
    if (
      !transferInfo.localWalletShield &&
      (sourcePool === 'transparent' || privacyMode.intent !== 'on')
    ) {
      return this.zcashBuildTransparentEncodedTx({
        transferInfo,
        sendMax: params.transferPayload?.isMaxSend === true,
      });
    }
    if (transferInfo.localWalletShield) {
      // Shield sweep: pcztShield takes no amount and deducts the fee from the
      // swept value. Keep the gross value so updateUnsignedTx can recompute
      // the displayed net amount from the exact shielding quote.
      const spendableT = new BigNumber(
        (await this.zcashGetBalanceSafe())?.poolsDetail.transparentRegular
          .spendable ?? '0',
      );
      const netDisplay = BigNumber.max(
        spendableT.minus(ZCASH_DISPLAY_FEE_ZAT),
        0,
      ).toFixed(0);
      return {
        inputs: [],
        outputs: [{ address: transferInfo.to, value: netDisplay }],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: ZCASH_DISPLAY_FEE_ZAT,
        txSize: 0,
        zcashTo: transferInfo.to,
        zcashAmountValue: netDisplay,
        zcashShieldingGrossValue: spendableT.toFixed(0),
        isShielding: true,
        zcashMode: 'privacy',
      };
    }
    let amountValue = new BigNumber(transferInfo.amount)
      .shiftedBy(ZCASH_DECIMALS)
      .toFixed(0, BigNumber.ROUND_DOWN);
    // Only an explicit Max request may change the entered amount. Ordinary
    // transfers must reach the proposer unchanged, even if the balance fell
    // since review or transparent inputs can cover a shielded shortfall.
    const spendSource: IZcashSpendSource =
      sourcePool === 'orchard' || sourcePool === 'ironwood'
        ? sourcePool
        : (requestedSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL);
    if (params.transferPayload?.isMaxSend === true) {
      const balanceForMax = await this.zcashGetBalanceSafe();
      if (!balanceForMax) {
        throw zcashTransparentError(
          'NOT_SYNCED',
          'Zcash spendable balance is unavailable. Refresh before sending Max.',
        );
      }
      const account = await this.zcashGetWalletAccount({
        accountId: this.accountId,
      });
      const api = await this.zcashGetApi();
      const spendable = getZcashSendSpendable(
        balanceForMax,
        spendSource,
        preferTransparentForShieldedSend,
      );
      let feeGuess = new BigNumber(ZCASH_DISPLAY_FEE_ZAT);
      let resolved: string | undefined;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const candidate = spendable.minus(feeGuess);
        if (candidate.lte(0)) break;
        try {
          // eslint-disable-next-line no-await-in-loop
          const { feeZat } = await api.quotePczt(account, {
            toAddress: transferInfo.to,
            valueZat: candidate.toFixed(0),
            spendSource,
            spendTransparent: preferTransparentForShieldedSend,
          });
          if (new BigNumber(feeZat).lte(feeGuess)) {
            resolved = candidate.toFixed(0);
            break;
          }
          feeGuess = new BigNumber(feeZat);
        } catch (e) {
          // Same rule as the withdraw ladder: an unaffordable probe's
          // INSUFFICIENT_FUNDS carries the exact shortfall -- guidance for
          // the next guess, not a failure of the max-send itself.
          const shortfall = zcashErrorAmount(e, 'shortfallZat');
          if (
            readZcashRuntimeError(e)?.code === 'INSUFFICIENT_FUNDS' &&
            shortfall !== null &&
            shortfall > 0
          ) {
            feeGuess = feeGuess.plus(String(shortfall));
            // eslint-disable-next-line no-continue
            continue;
          }
          throw toUserFacingZcashError(e);
        }
      }
      if (resolved === undefined) {
        throw toUserFacingZcashError(
          Object.assign(new Error('INSUFFICIENT_FUNDS'), {
            code: 'INSUFFICIENT_FUNDS',
            params: {},
          }),
        );
      }
      amountValue = resolved;
    }
    return {
      // btc-structural part (display intent only; note selection is wasm-side)
      inputs: [],
      outputs: [{ address: transferInfo.to, value: amountValue }],
      inputsForCoinSelect: [],
      outputsForCoinSelect: [],
      fee: ZCASH_DISPLAY_FEE_ZAT,
      txSize: 0,
      // zcash part
      zcashTo: transferInfo.to,
      zcashAmountValue: amountValue,
      zcashSpendSource: spendSource,
      zcashSpendTransparent: preferTransparentForShieldedSend,
      zcashMode: 'privacy',
    };
  }

  // The generic local-history store keeps only public-side rows for this
  // chain (SimpleDbEntityLocalHistory.canPersistLocalHistoryTx); a transparent
  // send must carry that tag or its pending row is dropped before the backend
  // indexes it.
  override async buildHistoryTx(
    params: Parameters<VaultBtc['buildHistoryTx']>[0],
  ): Promise<IAccountHistoryTx> {
    const historyTx = await super.buildHistoryTx(params);
    const encodedTx = historyTx.decodedTx.encodedTx as
      | IEncodedTxZcash
      | undefined;
    if (encodedTx?.zcashMode === 'transparent') {
      return {
        ...historyTx,
        privacyChainHistorySide: 'public',
        privacyChainHistoryPoolIds: [0],
      };
    }
    // Every locally built row is tagged: private rows must never reach the
    // shared local-history cache (SimpleDbEntityLocalHistory refuses them).
    return { ...historyTx, privacyChainHistorySide: 'private' };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxZcash;
    const network = await this.getNetwork();
    const account = await this.getAccount();

    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    const amount = new BigNumber(encodedTx.zcashAmountValue)
      .shiftedBy(-ZCASH_DECIMALS)
      .toFixed();

    let action = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: account.address,
        to: encodedTx.zcashTo,
      },
    } as IDecodedTx['actions'][0];

    if (nativeToken) {
      action = await this.buildTxTransferAssetAction({
        from: account.address,
        to: encodedTx.zcashTo,
        transfers: [
          {
            from: account.address,
            to: encodedTx.zcashTo,
            // Always the amount the transaction will carry: max-send and
            // shielding converge it here, so the UI figure can be stale.
            amount,
            tokenIdOnNetwork: nativeToken.address,
            icon: nativeToken.logoURI ?? '',
            name: nativeToken.name,
            symbol: nativeToken.symbol,
            isNFT: false,
            isNative: true,
          },
        ],
      });
    }

    return {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      encodedTx,
      totalFeeInNative: new BigNumber(encodedTx.fee || '0')
        .shiftedBy(-network.decimals)
        .toFixed(),
      nativeAmount: amount,
      nativeAmountValue: encodedTx.zcashAmountValue,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    const unsignedTx: IUnsignedTxPro = {
      encodedTx,
      transfersInfo: params.transfersInfo ?? [],
    };
    if (encodedTx.zcashMode !== 'privacy' || !this.accountId) {
      return unsignedTx;
    }
    return { ...unsignedTx, encodedTx: await this.zcashAttachPczt(encodedTx) };
  }

  // Builds the PCZT here, not at signing time, so the reviewed transaction is
  // the locked proposal itself: exact fee, exact inputs, and one object that
  // any keyring (software or hardware) signs the same way. The journal entry
  // is written before the runtime locks anything so a crash in between leaves
  // a releasable record rather than an orphaned lock.
  private async zcashAttachPczt(
    encodedTx: IEncodedTxZcash,
  ): Promise<IEncodedTxZcash> {
    const accountId = this.accountId;
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: shielded account meta missing (use retryLocalWalletSetup to retry)',
      );
    }
    const lifecycleMutex = getZcashLifecycleMutex(meta.ufvk);
    return lifecycleMutex.runExclusive(async () => {
      const privacyModeEnabled =
        await this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
          accountId,
        });
      if (!privacyModeEnabled) {
        throw zcashTransparentError(
          'PRIVACY_MODE_DISABLED',
          'Enable Zcash Privacy Mode before using a shielded pool',
        );
      }
      const reservationId = `${generateUUID()}${generateUUID()}`.replace(
        /-/g,
        '',
      );
      const expiryHeight = await this.zcashGetShieldedReservationExpiryHeight();
      await this.backgroundApi.simpleDb.zcash.saveShieldedReservation({
        accountId,
        reservationId,
        expiryHeight,
        state: 'unsigned',
      });
      let created: IZcashPcztReservation;
      try {
        created = encodedTx.isShielding
          ? await this.zcashShieldFunds({ accountId, reservationId })
          : await this.zcashCreatePczt({
              accountId,
              toAddress: encodedTx.zcashTo,
              valueZat: encodedTx.zcashAmountValue,
              spendSource:
                encodedTx.zcashSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL,
              spendTransparent: encodedTx.zcashSpendTransparent,
              reservationId,
            });
        if (created.reservationId !== reservationId) {
          throw new OneKeyLocalError(
            'zcash: runtime returned an unexpected reservation id',
          );
        }
      } catch (error) {
        await this.zcashAbandonPczt({ accountId, reservationId }).catch(() => {
          // A carrier failure may have happened after runtime reservation.
          // Keep the host journal until a later explicit release succeeds.
        });
        throw error;
      }
      // A shield sweep has no amount of its own: it is the swept value minus
      // the fee the proposer just charged.
      const amountValue = encodedTx.isShielding
        ? BigNumber.max(
            new BigNumber(encodedTx.zcashShieldingGrossValue ?? '0').minus(
              created.feeZat,
            ),
            0,
          ).toFixed(0)
        : encodedTx.zcashAmountValue;
      return {
        ...encodedTx,
        fee: created.feeZat,
        zcashAmountValue: amountValue,
        outputs: encodedTx.outputs.map((output, index) =>
          index === 0 ? { ...output, value: amountValue } : output,
        ),
        pcztHex: created.pcztHex,
        pcztReservationId: reservationId,
      };
    });
  }

  async zcashAssertPcztReservationLive(params: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    const reservations =
      await this.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId: params.accountId,
      });
    const reservation = reservations.find(
      ({ reservationId }) => reservationId === params.reservationId,
    );
    if (!reservation || reservation.state === 'signed') {
      throw Object.assign(
        new OneKeyLocalError(
          'This Zcash transaction review expired. Build and review a new transaction.',
        ),
        { code: 'STALE_PRIVACY_TRANSACTION', params: {} },
      );
    }
  }

  async zcashPreparePcztForSigning(params: {
    accountId: string;
    reservationId: string;
    pcztHex: string;
  }): Promise<{ pcztHex: string }> {
    await this.zcashAssertPcztReservationLive(params);
    return this.zcashProvePczt({
      accountId: params.accountId,
      pcztHex: params.pcztHex,
    });
  }

  async zcashCombineSignedPczt(params: {
    accountId: string;
    originalPcztHex: string;
    signedPcztHex: string;
  }): Promise<{ pcztHex: string }> {
    const api = await this.zcashGetApi();
    try {
      return await api.combinePczt({
        originalPcztHex: params.originalPcztHex,
        signedPcztHex: params.signedPcztHex,
      });
    } catch (e) {
      throw toUserFacingZcashError(e);
    }
  }

  async zcashCommitSignedPczt(params: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.zcash.markShieldedReservationSigned(
      params,
    );
  }

  async zcashAbandonPczt(params: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    await this.zcashReleasePczt(params);
    await this.backgroundApi.simpleDb.zcash.removeShieldedReservation(params);
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const feeValue = params.feeInfo?.feeUTXO?.feeValue;
    if (feeValue === undefined) {
      return params.unsignedTx;
    }
    const network = await this.getNetwork();
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxZcash;
    // Transparent fee is fixed at build; a PCZT carries its own exact fee.
    if (encodedTx.zcashMode === 'transparent' || encodedTx.pcztHex) {
      return params.unsignedTx;
    }
    const fee = new BigNumber(feeValue)
      .shiftedBy(network.feeMeta.decimals)
      .toFixed(0);
    const shieldingNet = encodedTx.isShielding
      ? BigNumber.max(
          new BigNumber(encodedTx.zcashShieldingGrossValue ?? '0').minus(fee),
          0,
        ).toFixed(0)
      : undefined;
    return {
      ...params.unsignedTx,
      encodedTx: {
        ...encodedTx,
        fee,
        ...(shieldingNet === undefined
          ? {}
          : {
              zcashAmountValue: shieldingNet,
              outputs: encodedTx.outputs.map((output, index) =>
                index === 0 ? { ...output, value: shieldingNet } : output,
              ),
            }),
      },
    };
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const encodedTx = signedTx.encodedTx as IEncodedTxZcash | undefined;
    if (encodedTx?.zcashMode === 'transparent') {
      const expectedTxid = encodedTx.zcashTransparentBuild?.txid;
      if (
        !expectedTxid ||
        signedTx.rawTx !== encodedTx.zcashTransparentBuild?.rawTx
      ) {
        throw zcashTransparentError(
          'INVALID_SIGNED_TRANSACTION',
          'Zcash transparent signed transaction is incomplete',
        );
      }
      let broadcast: ISignedTxPro;
      try {
        broadcast = await super.broadcastTransaction(params);
      } catch {
        // HTTP status alone cannot prove that the node did not accept the
        // transaction. A gateway can return 4xx (notably duplicate/409) after
        // upstream submission. Keep the outpoints locked until backend history
        // reports a terminal state or the transaction expires.
        throw zcashTransparentError(
          'BROADCAST_OUTCOME_UNKNOWN',
          'Zcash broadcast outcome is unknown. Recheck history before retrying.',
          { txid: expectedTxid, retryAfterMinutes: 15, canRecheck: true },
        );
      }
      if (broadcast.txid.toLowerCase() !== expectedTxid.toLowerCase()) {
        throw zcashTransparentError(
          'TXID_MISMATCH',
          'Zcash backend returned an unexpected transaction id',
          { expectedTxid, actualTxid: broadcast.txid },
        );
      }
      await this.backgroundApi.simpleDb.zcash.saveTransparentPendingTx({
        accountId: this.accountId,
        tx: {
          ownerId: checkIsDefined(encodedTx.zcashTransparentPlan).ownerId,
          rawTx: encodedTx.zcashTransparentBuild.rawTx,
          txid: expectedTxid,
          spentOutpoints: encodedTx.zcashTransparentBuild.spentOutpoints,
          expiryHeight: encodedTx.zcashTransparentBuild.expiryHeight,
          createdAt: Date.now(),
          broadcastState: 'accepted',
        },
      });
      return { ...broadcast, txid: expectedTxid };
    }
    const signedPcztHex = encodedTx?.signedPcztHex ?? signedTx.rawTx;
    if (!signedPcztHex) {
      throw new OneKeyLocalError('zcash: signed PCZT missing');
    }
    const reservationId = encodedTx?.pcztReservationId;
    if (!reservationId) {
      throw new OneKeyLocalError('zcash: PCZT input reservation missing');
    }
    const account = await this.zcashGetWalletAccount({
      accountId: this.accountId,
    });
    const api = await this.zcashGetApi();
    const lifecycleMutex = getZcashLifecycleMutex(account.ufvk);
    const { txid } = await lifecycleMutex.runExclusive(async () => {
      const [privacyModeEnabled, shieldedReservations] = await Promise.all([
        this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
          accountId: this.accountId,
        }),
        this.backgroundApi.simpleDb.zcash.listShieldedReservations({
          accountId: this.accountId,
        }),
      ]);
      if (
        !privacyModeEnabled ||
        !shieldedReservations.some(
          (reservation) => reservation.reservationId === reservationId,
        )
      ) {
        throw Object.assign(
          new OneKeyLocalError(
            'Zcash Privacy Mode changed or this transaction review expired. Build and review a new transaction.',
          ),
          { code: 'STALE_PRIVACY_TRANSACTION', params: {} },
        );
      }
      let finalizedTxid: string;
      try {
        ({ txid: finalizedTxid } = await api.finalizePczt(account, {
          pcztHex: signedPcztHex,
          reservationId,
        }));
      } catch (e) {
        const runtimeError = readZcashRuntimeError(e);
        if (runtimeError && runtimeError.code !== 'FINALIZE_OUTCOME_UNKNOWN') {
          try {
            await api.releasePczt(account, { reservationId });
            await this.backgroundApi.simpleDb.zcash.removeShieldedReservation({
              accountId: this.accountId,
              reservationId,
            });
          } catch (releaseError) {
            console.error(
              '[zcash] failed to release PCZT after finalize failure',
              {
                reservationId,
                error:
                  releaseError instanceof Error
                    ? releaseError.message
                    : String(releaseError),
              },
            );
          }
          throw toUserFacingZcashError(e);
        }
        // A carrier failure can happen after the runtime committed the spend
        // but before its txid response crossed back. Do not unlock or encourage
        // rebuilding: the existing transaction may be rebroadcast from history.
        const uncertain = new OneKeyLocalError(
          'Zcash transaction finalization is still being checked. Do not resend; refresh history first.',
        );
        Object.assign(uncertain, {
          code: 'FINALIZE_OUTCOME_UNKNOWN',
          params: {},
        });
        throw uncertain;
      }
      await this.backgroundApi.simpleDb.zcash.removeShieldedReservation({
        accountId: this.accountId,
        reservationId,
      });
      return { txid: finalizedTxid };
    });
    let sendResult: Awaited<ReturnType<typeof api.broadcastPczt>>;
    try {
      sendResult = await api.broadcastPczt(account, { txid });
    } catch (e) {
      sendResult = {
        txid,
        broadcastState: 'unknown',
        broadcastError: {
          code: 'BROADCAST_OUTCOME_UNKNOWN',
          params: {},
          detail: e instanceof Error ? e.message : String(e),
        },
      };
    }
    const { broadcastState, broadcastError } = sendResult;
    if (broadcastState === 'rejected') {
      const rejected = broadcastError ?? {
        code: 'BROADCAST_REJECTED',
        params: {},
      };
      throw toUserFacingZcashError(
        Object.assign(new Error(rejected.code), {
          ...rejected,
          payload: rejected,
        }),
      );
    } else if (broadcastState === 'unknown') {
      console.log('[zcash] broadcast outcome unknown; keeping tx pending', {
        txid,
        ...zcashDescribeError(
          broadcastError
            ? Object.assign(new Error(broadcastError.code), {
                ...broadcastError,
                payload: broadcastError,
              })
            : undefined,
        ),
      });
    }
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }
}
