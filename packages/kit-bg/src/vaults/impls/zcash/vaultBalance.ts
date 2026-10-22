import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import {
  isShieldedAddress,
  isZcashTexAddress,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import {
  ZCASH_CURRENT_SHIELDED_POOL,
  ZCASH_DECIMALS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { readZcashRuntimeError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashBalance,
  IZcashPoolDetail,
  IZcashSpendSource,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { ZCASH_SHIELDING_THRESHOLD_ZAT } from '@onekeyhq/shared/src/config/zcash';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import { composePrivacyChainBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import { PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
} from '@onekeyhq/shared/types/address';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import type { ITokenData, ITokenFiat } from '@onekeyhq/shared/types/token';

import { sumLocalWalletFrozen } from '../../localWallet/frozen';
import {
  LOCAL_WALLET_DISPLAY_WAIT_MS,
  readLastLocalWalletPublicBalance,
  readLocalWalletBalanceStaleFirst,
  readLocalWalletCacheEpoch,
  saveLastLocalWalletPublicBalance,
} from '../../localWallet/privacyChainCacheStore';

import {
  applyZcashBalanceToBackendTokenDetails,
  applyZcashBalanceToBackendTokenList,
} from './backendToken';
import {
  isZcashSetupIncompleteError,
  isZcashTransparentPayable,
  zcashDescribeError,
} from './vaultUtils';

import type Vault from './Vault';
import type { IDBUtxoAccount } from '../../../dbs/local/types';
import type { ILocalWalletBalanceRead } from '../../localWallet/privacyChainCacheStore';
import type {
  ILocalWalletAccountBalance,
  ILocalWalletFrozenPart,
  ILocalWalletFrozenReason,
  ILocalWalletPoolBalance,
  ILocalWalletSendPool,
} from '../../localWallet/types';

// Reached through the chain-only vault (accountId ''), so the account arrives as a parameter, never this.accountId.
export async function listLocalWalletSendPools(
  vault: Vault,
  {
    accountId,
    toAddress,
  }: {
    accountId: string;
    toAddress?: string;
  },
): Promise<ILocalWalletSendPool[] | undefined> {
  const privacyActive = await vault.zcashPrivacyModeIsActive(accountId);
  // Null while privacy is active means the scanner couldn't answer; private pools stay listed with no balance.
  const balance = privacyActive
    ? await vault.getLocalWalletBalance({ accountId, fresh: true })
    : null;
  // Transparent spendable comes from the indexer's UTXO set, the same input the transparent builder selects from.
  let transparentSpendable: string | undefined;
  let transparentTotal: string | undefined;
  try {
    const dbAccount = (await vault.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    })) as IDBUtxoAccount;
    const indexer = await vault.zcashGetIndexerTransparentBalance({
      account: dbAccount,
    });
    transparentSpendable = indexer.spendable?.toFixed(0);
    transparentTotal = indexer.total?.toFixed(0);
  } catch (e) {
    console.error('[zcash] transparent send pool balance failed', {
      ...zcashDescribeError(e),
    });
  }
  const toParsed = (value: string) => zatoshiToZec(value);
  const pool = (
    key: 'transparent' | IZcashSpendSource,
    label: string,
    spendable: string | undefined,
    isDefault?: boolean,
    total?: string,
    eligible?: boolean,
    hintId?: ILocalWalletSendPool['hintId'],
  ): ILocalWalletSendPool => ({
    key,
    label,
    spendable,
    spendableParsed: spendable === undefined ? undefined : toParsed(spendable),
    isDefault,
    ...(eligible === undefined ? {} : { eligible }),
    ...(total === undefined ? {} : { total, totalParsed: toParsed(total) }),
    ...(hintId === undefined ? {} : { hintId }),
  });
  if (!privacyActive) {
    return [
      pool(
        'transparent',
        'Transparent',
        transparentSpendable,
        true,
        transparentTotal,
        !toAddress || isZcashTransparentPayable(toAddress),
      ),
    ];
  }
  // An unfinished scan gives a floor and Max spends it as a total; say so once the gap is big enough to matter.
  let partialScanHint: ILocalWalletSendPool['hintId'];
  if (balance?.isComplete === false) {
    const progress = await vault.backgroundApi.servicePrivacyChain
      .getLocalWalletSyncProgress({ networkId: vault.networkId, accountId })
      .catch(() => undefined);
    const scanned = progress?.backfillScannedHeight;
    const target = progress?.backfillTargetHeight;
    const remaining =
      typeof scanned === 'number' && typeof target === 'number'
        ? Math.max(0, target - scanned)
        : undefined;
    // The light's bar, so the hint and the light agree.
    if (
      remaining === undefined ||
      remaining >= PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT
    ) {
      partialScanHint = ETranslations.global_syncing;
    }
  }
  // A transparent recipient defaults to transparent inputs; unified recipients can also use transparent UTXOs.
  const transparentRecipient = !!toAddress && !isShieldedAddress(toAddress);
  // ZIP-320: a TEX address (exchange deposits) accepts transparent funds only.
  const texRecipient = !!toAddress && isZcashTexAddress(toAddress);
  const shieldedDefault = (key: IZcashSpendSource) =>
    !transparentRecipient && ZCASH_CURRENT_SHIELDED_POOL === key;
  return [
    pool(
      'ironwood',
      'Ironwood',
      // Its own funds only: the figure shown is exactly what Max sends.
      balance?.poolsDetail.ironwood.spendable,
      shieldedDefault('ironwood'),
      undefined,
      !texRecipient,
      partialScanHint,
    ),
    pool(
      'orchard',
      'Orchard',
      balance?.poolsDetail.orchard.spendable,
      shieldedDefault('orchard'),
      undefined,
      !texRecipient,
      partialScanHint,
    ),
    pool(
      'transparent',
      'Transparent',
      transparentSpendable,
      transparentRecipient,
      transparentTotal,
      !toAddress || transparentRecipient || toAddress.startsWith('u1'),
    ),
  ];
}

// Display reads only: sends and shields fetch fresh UTXOs and keep the
// default retries.
const ZCASH_TRANSPARENT_DISPLAY_WAIT_MS = 3000;
const ZCASH_TRANSPARENT_DISPLAY_RAW_TX_RETRIES = 1;
// A late result serves every read in this window, so whichever page asks
// first does not take it from the others.
const ZCASH_TRANSPARENT_LANDED_REUSE_MS = 5000;
// While the next read is slow, a result this recent stays on screen as
// current instead of the saved pair coming back as not current.
const ZCASH_TRANSPARENT_LAST_READ_MAX_AGE_MS = 60_000;

type IZcashTransparentDisplay = {
  total?: BigNumber;
  spendable?: BigNumber;
  // Saved from an earlier read; the fresh one has not answered yet.
  stale?: boolean;
};

type IZcashTransparentDisplayRead = {
  value: IZcashTransparentDisplay;
  at: number;
};

type IZcashTransparentDisplayEntry = {
  // The account epoch the reads were started under (see privacyChainState);
  // an entry from another epoch is a miss.
  epoch: string | undefined;
  running?: Promise<IZcashTransparentDisplay>;
  // A result that answered after its page gave up on it.
  landed?: IZcashTransparentDisplayRead;
  // The last complete result, late or not.
  lastRead?: IZcashTransparentDisplayRead;
};

const ZCASH_TRANSPARENT_DISPLAY_KINDS = ['spendable', 'all'] as const;

// Keyed by network, account and read kind; only the most recent accounts.
const zcashTransparentDisplayReads = new LRUCache<
  string,
  IZcashTransparentDisplayEntry
>({ max: 32 });

function zcashTransparentDisplayKey(
  networkId: string,
  accountId: string,
  kind: (typeof ZCASH_TRANSPARENT_DISPLAY_KINDS)[number],
) {
  return `${networkId}:${accountId}:${kind}`;
}

// Every account's when none is named.
export function forgetZcashTransparentDisplayReads({
  networkId,
  accountIds,
}: {
  networkId: string;
  accountIds?: string[];
}) {
  if (!accountIds) {
    zcashTransparentDisplayReads.clear();
    return;
  }
  for (const accountId of accountIds) {
    for (const kind of ZCASH_TRANSPARENT_DISPLAY_KINDS) {
      zcashTransparentDisplayReads.delete(
        zcashTransparentDisplayKey(networkId, accountId, kind),
      );
    }
  }
}

function zcashTransparentPair(value: IZcashTransparentDisplay) {
  return value.total && value.spendable
    ? { total: value.total.toFixed(0), spendable: value.spendable.toFixed(0) }
    : undefined;
}

function zcashTransparentDisplayComplete(
  value: IZcashTransparentDisplay,
  spendableOnly: boolean,
): boolean {
  return spendableOnly
    ? value.spendable !== undefined
    : zcashTransparentPair(value) !== undefined;
}

function zcashTransparentDisplaySame(
  left: IZcashTransparentDisplay,
  right: IZcashTransparentDisplay,
): boolean {
  return (
    left.total?.toFixed(0) === right.total?.toFixed(0) &&
    left.spendable?.toFixed(0) === right.spendable?.toFixed(0)
  );
}

export async function zcashReadTransparentForDisplay(
  vault: Vault,
  {
    account,
    spendableOnly = false,
  }: {
    account: IDBUtxoAccount;
    // The composed balance takes its total from the backend token list
    // already; asking for it again would be one more request per refresh.
    spendableOnly?: boolean;
  },
): Promise<IZcashTransparentDisplay> {
  const key = zcashTransparentDisplayKey(
    vault.networkId,
    account.id,
    spendableOnly ? 'spendable' : 'all',
  );
  const epoch = await readLocalWalletCacheEpoch({
    backgroundApi: vault.backgroundApi,
    accountId: account.id,
  });
  const stored = zcashTransparentDisplayReads.get(key);
  const previous = stored?.epoch === epoch ? stored : undefined;
  if (
    previous?.landed &&
    Date.now() - previous.landed.at < ZCASH_TRANSPARENT_LANDED_REUSE_MS
  ) {
    return previous.landed.value;
  }
  const lastRead = previous?.lastRead;
  let running = previous?.running;
  if (!running) {
    running = spendableOnly
      ? vault
          .zcashFetchFreshTransparentUtxos({
            account,
            rawTxRetries: ZCASH_TRANSPARENT_DISPLAY_RAW_TX_RETRIES,
          })
          .then((fresh) => ({
            spendable: fresh.utxos.reduce(
              (sum, utxo) => sum.plus(utxo.valueZat),
              new BigNumber(0),
            ),
          }))
      : vault.zcashGetIndexerTransparentBalance({
          account,
          rawTxRetries: ZCASH_TRANSPARENT_DISPLAY_RAW_TX_RETRIES,
        });
    if (!spendableOnly) {
      // Saved beside the read, not in front of it. Only a complete pair is
      // saved, so a saved total and spendable always come from one read.
      void running.then(
        async (value) => {
          const pair = zcashTransparentPair(value);
          if (!pair) return;
          await saveLastLocalWalletPublicBalance({
            backgroundApi: vault.backgroundApi,
            networkId: vault.networkId,
            accountId: account.id,
            epoch,
            value: pair,
          });
        },
        () => undefined,
      );
    }
    zcashTransparentDisplayReads.set(key, { epoch, running, lastRead });
  }
  // Full reads only (the pool view); the composed balance keeps waiting.
  let shown: IZcashTransparentDisplay | undefined;
  if (!spendableOnly) {
    if (
      lastRead &&
      Date.now() - lastRead.at <= ZCASH_TRANSPARENT_LAST_READ_MAX_AGE_MS
    ) {
      shown = lastRead.value;
    } else {
      const savedRecord = await readLastLocalWalletPublicBalance({
        backgroundApi: vault.backgroundApi,
        networkId: vault.networkId,
        accountId: account.id,
        epoch,
      });
      shown = savedRecord && {
        total: new BigNumber(savedRecord.total),
        spendable: new BigNumber(savedRecord.spendable),
        stale: true,
      };
    }
  }
  const outcome = await Promise.race([
    running.then(
      (value) => ({ settled: true as const, value }),
      (error: unknown) => {
        console.error('[zcash] transparent display read failed', {
          ...zcashDescribeError(error),
        });
        return { settled: true as const, value: {} };
      },
    ),
    timerUtils
      .wait(
        shown
          ? LOCAL_WALLET_DISPLAY_WAIT_MS
          : ZCASH_TRANSPARENT_DISPLAY_WAIT_MS,
      )
      .then(() => ({ settled: false as const })),
  ]);
  if (outcome.settled) {
    const current = zcashTransparentDisplayReads.get(key);
    if (current?.running === running) {
      zcashTransparentDisplayReads.set(key, {
        epoch,
        lastRead: zcashTransparentDisplayComplete(outcome.value, spendableOnly)
          ? { value: outcome.value, at: Date.now() }
          : current.lastRead,
      });
    }
    return outcome.value;
  }
  // Shown as before or unknown for now; the next read gets the result.
  const pending = running;
  void pending.then(
    (value) => {
      const current = zcashTransparentDisplayReads.get(key);
      if (current?.running !== pending) return;
      // A partial read is worse than a complete pair already on screen.
      if (shown && !zcashTransparentDisplayComplete(value, spendableOnly)) {
        zcashTransparentDisplayReads.set(key, {
          epoch,
          lastRead: current.lastRead,
        });
        return;
      }
      const landed = { value, at: Date.now() };
      zcashTransparentDisplayReads.set(key, {
        epoch,
        landed,
        lastRead: zcashTransparentDisplayComplete(value, spendableOnly)
          ? landed
          : current.lastRead,
      });
      const changed = !shown || !zcashTransparentDisplaySame(shown, value);
      if (changed) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
      }
      // Even an unchanged value replaces a saved one marked not current.
      if (changed || shown?.stale) {
        appEventBus.emit(EAppEventBusNames.LocalWalletBalanceLanded, {
          networkId: vault.networkId,
          accountId: account.id,
        });
      }
    },
    () => {
      const current = zcashTransparentDisplayReads.get(key);
      if (current?.running === pending) {
        zcashTransparentDisplayReads.set(key, {
          epoch,
          lastRead: current.lastRead,
        });
      }
    },
  );
  return shown ?? {};
}

export async function getLocalWalletAccountBalance(
  vault: Vault,
  {
    accountId,
  }: {
    accountId: string;
  },
): Promise<ILocalWalletAccountBalance | null> {
  // The halves are read side by side: neither waits on the other.
  const [balance, transparent] = await Promise.all([
    // Gate covers the private half only; gating transparent too would hide funds the account can still spend.
    (async () =>
      (await vault.zcashPrivacyModeIsActive(accountId))
        ? vault.getLocalWalletBalance({
            accountId,
            liveWaitMs: LOCAL_WALLET_DISPLAY_WAIT_MS,
          })
        : null)(),
    (async () => {
      try {
        const account = (await vault.backgroundApi.serviceAccount.getDBAccount({
          accountId,
        })) as IDBUtxoAccount;
        return await zcashReadTransparentForDisplay(vault, { account });
      } catch (e) {
        console.error('[zcash] transparent pool balance failed', {
          ...zcashDescribeError(e),
        });
        return {};
      }
    })(),
  ]);
  const zat = (value: string | undefined) => new BigNumber(value ?? '0');
  const parsed = (value: string | undefined) => zatoshiToZec(value ?? '0');
  const frozenPart = (
    reason: ILocalWalletFrozenReason,
    amount: BigNumber,
  ): ILocalWalletFrozenPart[] =>
    amount.gt(0) ? [{ reason, amountParsed: parsed(amount.toFixed(0)) }] : [];
  const poolFrozen = (detail: IZcashPoolDetail): ILocalWalletFrozenPart[] => [
    ...frozenPart('pendingSend', zat(detail.locked)),
    ...frozenPart(
      'confirming',
      zat(detail.pendingChange).plus(detail.pendingSpendable),
    ),
    ...frozenPart('smallChange', zat(detail.uneconomic)),
  ];

  const transparentSpendable = transparent.spendable;
  const transparentTotal = transparent.total;
  const transparentStatus = transparent.stale ? 'partial' : 'complete';
  const transparentFrozen =
    transparentTotal && transparentSpendable
      ? frozenPart('confirming', transparentTotal.minus(transparentSpendable))
      : [];
  const knownPrivateStatus = balance?.isComplete ? 'complete' : 'partial';
  const incompleteStatus =
    balance || transparentTotal !== undefined ? 'partial' : 'unavailable';
  const privatePool = (
    key: IZcashSpendSource,
    total: string | undefined,
    detail: IZcashPoolDetail | undefined,
    extraHints: string[],
  ): ILocalWalletPoolBalance => ({
    key,
    balanceStatus: balance ? knownPrivateStatus : 'unavailable',
    total,
    totalParsed: total === undefined ? undefined : parsed(total),
    spendable: detail?.spendable,
    spendableParsed:
      detail === undefined ? undefined : parsed(detail.spendable),
    hints: extraHints,
    frozen: detail ? poolFrozen(detail) : [],
    move: {
      type: 'withdraw',
      amountParsed:
        detail && zat(detail.spendable).gt(0)
          ? parsed(detail.spendable)
          : undefined,
      enabled: !!detail && zat(detail.spendable).gt(0),
    },
  });
  const pools: ILocalWalletPoolBalance[] = [
    {
      key: 'transparent',
      balanceStatus:
        transparentTotal === undefined ? 'unavailable' : transparentStatus,
      total: transparentTotal?.toFixed(0),
      totalParsed:
        transparentTotal === undefined
          ? undefined
          : parsed(transparentTotal.toFixed(0)),
      spendable: transparentSpendable?.toFixed(0),
      spendableParsed:
        transparentSpendable === undefined
          ? undefined
          : parsed(transparentSpendable.toFixed(0)),
      hints: [],
      frozen: transparentFrozen,
      move: {
        type: 'shield',
        amountParsed: transparentSpendable?.gt(0)
          ? parsed(transparentSpendable.toFixed(0))
          : undefined,
        // Dust below the threshold is rejected by the sweep proposer. A saved
        // pair is display only: shielding waits for a current read.
        enabled:
          !transparent.stale &&
          (transparentSpendable?.gte(ZCASH_SHIELDING_THRESHOLD_ZAT) ?? false),
      },
    },
    privatePool(
      'ironwood',
      balance?.ironwoodBalance,
      balance?.poolsDetail.ironwood,
      [],
    ),
    privatePool(
      'orchard',
      balance?.orchardBalance,
      balance?.poolsDetail.orchard,
      [],
    ),
  ];
  return {
    balanceStatus:
      balance?.isComplete &&
      transparentTotal !== undefined &&
      !transparent.stale
        ? 'complete'
        : incompleteStatus,
    total: balance?.isComplete
      ? transparentTotal?.plus(balance.shielded).toFixed(0)
      : undefined,
    totalParsed:
      !balance?.isComplete || transparentTotal === undefined
        ? undefined
        : parsed(transparentTotal.plus(balance.shielded).toFixed(0)),
    spendable: balance
      ? transparentSpendable?.plus(balance.shieldedSpendable).toFixed(0)
      : undefined,
    pools,
    frozen: sumLocalWalletFrozen(pools),
  };
}

// A saved figure may predate funds the scanner has since found.
function zcashBalanceFromRead(
  result: ILocalWalletBalanceRead<IZcashBalance> | null,
): IZcashBalance | null {
  if (!result) return null;
  return result.stale ? { ...result.value, isComplete: false } : result.value;
}

export async function getLocalWalletBalance(
  vault: Vault,
  {
    accountId,
    liveWaitMs,
    fresh = false,
  }: {
    accountId: string;
    liveWaitMs?: number;
    // Send paths: a failed scanner read is unavailable, never the saved value.
    fresh?: boolean;
  },
): Promise<IZcashBalance | null> {
  try {
    const result = await readLocalWalletBalanceStaleFirst<IZcashBalance>({
      backgroundApi: vault.backgroundApi,
      networkId: vault.networkId,
      accountId,
      liveWaitMs: fresh ? undefined : liveWaitMs,
      read: async () => {
        try {
          const account = await vault.zcashGetWalletAccount({ accountId });
          const api = await vault.zcashGetApi();
          return await api.getBalance(account);
        } catch (e) {
          console.error('[zcash] getLocalWalletBalance failed', {
            accountId,
            ...zcashDescribeError(e),
          });
          throw e;
        }
      },
    });
    if (fresh && result?.stale) return null;
    return zcashBalanceFromRead(result);
  } catch {
    return null;
  }
}

export async function zcashGetBalanceSafe(
  vault: Vault,
): Promise<IZcashBalance | null> {
  // accountId '' (chain-only vault, or UI still settling) must bail here, not reach the auto-repair path.
  if (!vault.accountId) {
    return null;
  }
  const privacyModeState =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId: vault.accountId,
      },
    );
  if (privacyModeState.intent !== 'on') {
    return null;
  }
  try {
    const account = await vault.zcashGetWalletAccount({
      accountId: vault.accountId,
    });
    const api = await vault.zcashGetApi();
    return await api.getBalance(account);
  } catch (e) {
    // Self-heal missing shielded meta here, since every trigger lands in this catch; no-op if locked.
    if (readZcashRuntimeError(e)?.code === 'NOT_SYNCED') return null;
    // Only an unfinished setup is repairable here; retrying on any other failure would re-derive keys every poll.
    const repaired =
      isZcashSetupIncompleteError(e) &&
      (await vault.zcashTryAutoRepairLocalWalletSetupIfUnlocked());
    if (repaired) {
      try {
        const account = await vault.zcashGetWalletAccount({
          accountId: vault.accountId,
        });
        const api = await vault.zcashGetApi();
        return await api.getBalance(account);
      } catch (e2) {
        if (readZcashRuntimeError(e2)?.code === 'NOT_SYNCED') return null;
        console.error('[zcash] getBalance still failing after auto repair', {
          accountId: vault.accountId,
          ...zcashDescribeError(e2),
        });
        throw e2;
      }
    }
    // Keep setup unavailable so Repair stays reachable, instead of claiming an unscanned wallet is empty.
    if (isZcashSetupIncompleteError(e)) {
      return null;
    }
    // Transient carrier failures keep the previous cached snapshot instead of replacing it with nothing.
    throw e;
  }
}

export async function fetchAccountDetails(
  vault: Vault,
  params: IFetchServerAccountDetailsParams,
): Promise<IFetchServerAccountDetailsResponse> {
  const privacyModeState =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId: params.accountId || vault.accountId,
      },
    );
  if (privacyModeState.intent !== 'on') {
    return vault.baseFetchAccountDetails(params);
  }
  let serverResponse: IFetchServerAccountDetailsResponse | undefined;
  try {
    serverResponse = await vault.baseFetchAccountDetails(params);
  } catch (e) {
    console.error('[zcash] backend account details fetch failed', {
      ...zcashDescribeError(e),
    });
  }
  const balance = await vault.zcashGetComposedBalanceSafe(
    serverResponse?.data.data.balance,
  );
  // Same split as the other chains: the balance-details dialog labels `balance` as spendable.
  const { total, spendable, frozen } = balance;
  return {
    data: {
      data: {
        ...serverResponse?.data.data,
        address: params.accountAddress,
        balance: spendable,
        balanceParsed: spendable === '' ? '' : zatoshiToZec(spendable),
        totalBalance: total,
        totalBalanceParsed: total === '' ? '' : zatoshiToZec(total),
        frozenBalance: frozen,
        frozenBalanceParsed: frozen === '' ? '' : zatoshiToZec(frozen),
      },
    },
  };
}

export async function fetchTokenList(
  vault: Vault,
  params: IFetchServerTokenListParams,
): Promise<IFetchServerTokenListResponse> {
  const privacyModeState =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId: params.accountId || vault.accountId,
      },
    );
  if (privacyModeState.intent !== 'on') {
    return vault.baseFetchTokenList(params);
  }
  const network = await vault.getNetwork();
  let serverResponse: IFetchServerTokenListResponse | undefined;
  try {
    serverResponse = await vault.baseFetchTokenList(params);
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
  const balance = await vault.zcashGetComposedBalanceSafe(
    serverNativeFiat?.balance,
  );
  const total = balance.total;
  const balanceParsed = total === '' ? '' : zatoshiToZec(total);

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
      balanceStatus: balance.balanceStatus,
      fiatValue: total === '0' ? '0' : '',
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

// The only transparent balance source: indexer total, plus the eligible UTXO sum as spendable.
export async function zcashGetIndexerTransparentBalance(
  vault: Vault,
  {
    account,
    rawTxRetries,
  }: {
    account: IDBUtxoAccount;
    rawTxRetries?: number;
  },
): Promise<{
  total?: BigNumber;
  spendable?: BigNumber;
  coinbase?: BigNumber;
}> {
  const [utxosResult, totalResult] = await Promise.allSettled([
    vault.zcashFetchFreshTransparentUtxos({ account, rawTxRetries }),
    vault.baseFetchTokenDetails({
      accountId: account.id,
      accountAddress: account.address,
      xpub: account.xpubSegwit || account.xpub,
      networkId: vault.networkId,
      contractList: [''],
    }),
  ]);
  let spendable: BigNumber | undefined;
  let total: BigNumber | undefined;
  let coinbase: BigNumber | undefined;
  if (utxosResult.status === 'fulfilled') {
    spendable = utxosResult.value.utxos.reduce(
      (sum, utxo) => sum.plus(utxo.valueZat),
      new BigNumber(0),
    );
    coinbase = new BigNumber(utxosResult.value.coinbaseZat);
  } else {
    console.error('[zcash] indexer transparent spendable failed', {
      ...zcashDescribeError(utxosResult.reason),
    });
  }
  if (totalResult.status === 'fulfilled') {
    const nativeToken = totalResult.value.data.data.find(
      (token) => token.info.isNative || token.info.address === '',
    );
    const indexerTotal = new BigNumber(nativeToken?.balance ?? '');
    if (indexerTotal.isFinite() && indexerTotal.gte(0)) {
      total =
        spendable === undefined
          ? indexerTotal
          : BigNumber.max(indexerTotal, spendable);
    }
  } else {
    console.error('[zcash] indexer transparent total failed', {
      ...zcashDescribeError(totalResult.reason),
    });
  }
  return { total, spendable, coinbase };
}

// Indexer balance counts every confirmation, but the builder only spends UTXOs past the trust threshold.
export async function zcashFetchTransparentTokenDetails(
  vault: Vault,
  params: IFetchServerTokenDetailParams,
): Promise<IFetchServerTokenDetailResponse> {
  const serverResponse = await vault.baseFetchTokenDetails(params);
  const nativeToken = serverResponse.data.data.find(
    (token) => token.info.isNative || token.info.address === '',
  );
  if (!nativeToken) {
    return serverResponse;
  }
  // Also fetched by account-less (network-level) vaults, where there's no spendable sum to compute.
  if (!vault.accountId) {
    return serverResponse;
  }
  let spendable: BigNumber;
  try {
    const fresh = await vault.zcashFetchFreshTransparentUtxos();
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
    },
    decimals: ZCASH_DECIMALS,
  });
  return serverResponse;
}

// Backend supplies the transparent side and pricing; the runtime supplies every shielded pool and the real spendable figure.
export async function fetchTokenDetails(
  vault: Vault,
  params: IFetchServerTokenDetailParams,
): Promise<IFetchServerTokenDetailResponse> {
  const privacyModeState =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId: params.accountId || vault.accountId,
      },
    );
  if (privacyModeState.intent !== 'on') {
    return vault.zcashFetchTransparentTokenDetails(params);
  }
  const network = await vault.getNetwork();
  let serverResponse: IFetchServerTokenDetailResponse | undefined;
  try {
    serverResponse = await vault.baseFetchTokenDetails(params);
  } catch (e) {
    console.error('[zcash] backend token details fetch failed', {
      ...zcashDescribeError(e),
    });
  }
  const serverNativeToken = serverResponse?.data.data.find(
    (token) => token.info.isNative || token.info.address === '',
  );
  const balance = await vault.zcashGetComposedBalanceSafe(
    serverNativeToken?.balance,
  );
  const total = new BigNumber(balance.total);
  // Account availability includes transparent funds; Send Max uses the explicitly selected pool, not this aggregate.
  const spendable = new BigNumber(balance.spendable);
  const frozen = new BigNumber(balance.frozen);
  const toParsed = (v: BigNumber) => (v.isFinite() ? zatoshiToZec(v) : '');
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
  const spendableFiatValue = spendable.isZero() ? '0' : '';
  const frozenFiatValue = frozen.isZero() ? '0' : '';
  const totalFiatValue = total.isZero() ? '0' : '';
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
          balance: balance.spendable,
          balanceStatus: balance.balanceStatus,
          balanceParsed: toParsed(spendable),
          frozenBalance: balance.frozen,
          frozenBalanceParsed: toParsed(frozen),
          totalBalance: balance.total,
          totalBalanceParsed: totalParsed,
          fiatValue: spendableFiatValue,
          frozenBalanceFiatValue: frozenFiatValue,
          totalBalanceFiatValue: totalFiatValue,
        },
      ],
    },
  };
}

// One composed balance for every surface; transparent spendable is the builder's validated UTXO set, private the runtime's.
export async function zcashGetComposedBalanceSafe(
  vault: Vault,
  publicSideBackend?: string,
): Promise<IPrivacyChainComposedBalance> {
  // Display only: Max and other spends read the scanner and UTXOs live.
  const [balance, transparent] = await Promise.all([
    vault.accountId
      ? readLocalWalletBalanceStaleFirst<IZcashBalance>({
          backgroundApi: vault.backgroundApi,
          networkId: vault.networkId,
          accountId: vault.accountId,
          liveWaitMs: LOCAL_WALLET_DISPLAY_WAIT_MS,
          read: () => vault.zcashGetBalanceSafe(),
        }).then(zcashBalanceFromRead)
      : null,
    (async () => {
      try {
        const account = (await vault.getAccount()) as IDBUtxoAccount;
        return await zcashReadTransparentForDisplay(vault, {
          account,
          spendableOnly: true,
        });
      } catch (e) {
        console.error('[zcash] account transparent availability failed', {
          ...zcashDescribeError(e),
        });
        return {};
      }
    })(),
  ]);
  const transparentSpendable = transparent.spendable;
  return composePrivacyChainBalance({
    privateSide: balance?.shielded,
    privateSideComplete: balance?.isComplete === true,
    publicSideIndexer: publicSideBackend,
    spendable: balance
      ? transparentSpendable?.plus(balance.shieldedSpendable).toFixed(0)
      : undefined,
  });
}
