import BigNumber from 'bignumber.js';

import { getAddressFromXpub } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IUtxoInfo } from '@onekeyhq/core/src/chains/btc/types';
import {
  encodeAddress as encodeZcashAddress,
  getZcashAccountIndexFromXpub,
  zcashTransparentAddressForScript,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { ZCASH_DECIMALS } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { toUserFacingZcashError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/errorCopy';
import {
  fetchZcashChainTipDirect,
  fetchZcashTransactionMissingDirect,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import {
  TRANSPARENT_TX_EXPIRY_DELTA,
  TRUSTED_CONFIRMATIONS,
  UNTRUSTED_CONFIRMATIONS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/policy';
import type {
  IZcashParsedTransparentTransaction,
  IZcashTransparentOutpoint,
  IZcashTransparentTxQuote,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { loadCachedLocalWalletHistory } from '../../localWallet/cachedHistory';

import {
  ZCASH_TRANSPARENT_P2PKH_SCRIPT_RE,
  ZCASH_TRANSPARENT_PATH_RE,
  isZcashTransparentPayable,
  sameOutpoints,
  zcashTransparentError,
} from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBUtxoAccount } from '../../../dbs/local/types';
import type { IZcashTransparentPendingTx } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import type { IBuildEncodedTxParams } from '../../types';

export async function zcashReplayUnknownTransparentBroadcast(
  vault: Vault,
  {
    accountId,
    tx,
  }: {
    accountId: string;
    tx: IZcashTransparentPendingTx;
  },
): Promise<void> {
  if (tx.broadcastAuthorized !== true) {
    return;
  }
  try {
    const dbAccount = await vault.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    });
    const result = await vault.zcashBroadcastTransparentViaBackend({
      accountId,
      networkId: vault.networkId,
      accountAddress: dbAccount.address,
      signedTx: { txid: tx.txid, rawTx: tx.rawTx, encodedTx: null },
    });
    if (result.txid.toLowerCase() === tx.txid.toLowerCase()) {
      await vault.backgroundApi.simpleDb.zcash.markTransparentPendingTxAccepted(
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

export async function zcashPruneTransparentSendHistory(
  vault: Vault,
  accountId: string,
  cachedHistory?: IAccountHistoryTx[],
  chainTip?: number,
): Promise<void> {
  const pending =
    await vault.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
      accountId,
    });
  // Builds with no signed journal need no extra history or network reads.
  if (!pending.length && !cachedHistory?.length) return;
  const account = (await vault.backgroundApi.serviceAccount.getDBAccount({
    accountId,
  })) as IDBUtxoAccount;
  const cached =
    cachedHistory ??
    (await loadCachedLocalWalletHistory({
      backgroundApi: vault.backgroundApi,
      networkId: vault.networkId,
      accountAddress: account.address,
      xpub: account.xpub,
    }));
  const expiryByTxid = new Map(
    pending.map((tx) => [tx.txid.toLowerCase(), tx.expiryHeight]),
  );
  for (const tx of cached) {
    const encoded = tx.decodedTx.encodedTx as IEncodedTxZcash | undefined;
    const expiry =
      encoded?.zcashTransparentBuild?.expiryHeight ?? encoded?.expiry;
    if (
      tx.decodedTx.status === EDecodedTxStatus.Pending &&
      encoded?.zcashMode === 'transparent' &&
      expiry !== undefined
    ) {
      expiryByTxid.set(tx.decodedTx.txid.toLowerCase(), expiry);
    }
  }
  if (!expiryByTxid.size) return;
  const lightwalletdUrl = await vault.zcashResolveLightwalletdUrl();
  const height =
    chainTip ?? (await fetchZcashChainTipDirect({ lightwalletdUrl }));
  if (height === null) return;
  // Expiry alone can't distinguish an unmined send from a lagging indexer; require the node to explicitly report absence.
  const candidates = [...expiryByTxid]
    .filter(([, expiry]) => expiry < height)
    .slice(0, 8);
  const missing = await Promise.all(
    candidates.map(async ([txid]) =>
      (await fetchZcashTransactionMissingDirect({ lightwalletdUrl, txid }))
        ? txid
        : undefined,
    ),
  );
  const expired = new Set(
    missing.filter((txid): txid is string => txid !== undefined),
  );
  const rows = cached
    .filter(
      (tx) =>
        tx.decodedTx.status === EDecodedTxStatus.Pending &&
        expired.has(tx.decodedTx.txid.toLowerCase()),
    )
    .map((tx) => ({
      ...tx,
      decodedTx: {
        ...tx.decodedTx,
        status: EDecodedTxStatus.Dropped,
        broadcastOutcomeUnknown: false,
      },
    }));
  if (rows.length) {
    await vault.backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs([
      {
        networkId: vault.networkId,
        accountAddress: account.address,
        xpub: account.xpub,
        confirmedTxs: rows,
        confirmedTxsToSave: rows,
      },
    ]);
  }
  // Persist the terminal row before releasing its journal, so storage
  // failures are retryable; an HTTP failure never releases signed inputs.
  await Promise.all(
    [...expired].map((txid) =>
      vault.backgroundApi.simpleDb.zcash.settleTransparentPendingTx({
        accountId,
        txid,
      }),
    ),
  );
  await vault.backgroundApi.simpleDb.zcash.pruneExpiredTransparentState({
    accountId,
    currentHeight: height,
    retainPending: true,
  });
}

export function zcashTransparentAccountIndex(
  vault: Vault,
  account: IDBUtxoAccount,
): number {
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

export function zcashNormalizeTransparentPath(
  vault: Vault,
  {
    path,
    accountIndex,
  }: {
    path: string;
    accountIndex: number;
  },
): { derivationPath: string; internal: boolean } | undefined {
  const derivationPath = path.startsWith('m/')
    ? path
    : `m/44'/133'/${accountIndex}'/${path.replace(/^\//, '')}`;
  const match = ZCASH_TRANSPARENT_PATH_RE.exec(derivationPath);
  if (!match || Number(match[1]) !== accountIndex) return undefined;
  return { derivationPath, internal: match[2] === '1' };
}

export async function zcashFetchFreshTransparentUtxos(
  vault: Vault,
  options?: {
    // Chain-only vault callers (capability methods) name the account.
    account?: IDBUtxoAccount;
    // Display reads only; spends keep the default.
    rawTxRetries?: number;
  },
): Promise<{
  account: IDBUtxoAccount;
  accountIndex: number;
  targetHeight: number;
  utxos: IZcashTransparentTxRequest['utxos'];
  // Owned mining rewards this build path cannot spend or shield.
  coinbaseZat: string;
}> {
  const account =
    options?.account ?? ((await vault.getAccount()) as IDBUtxoAccount);
  const accountIndex = vault.zcashTransparentAccountIndex(account);
  const response = await vault.baseFetchAccountDetails({
    networkId: vault.networkId,
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

  const confirmedUtxos = (serverUtxos as IUtxoInfo[]).filter(
    (utxo) =>
      /^[0-9a-f]{64}$/i.test(utxo.txid) &&
      Number.isSafeInteger(utxo.vout) &&
      utxo.vout >= 0 &&
      Number.isSafeInteger(utxo.height) &&
      utxo.height > 0 &&
      Number.isSafeInteger(utxo.confirmations) &&
      utxo.confirmations > 0,
  );
  const txids = [
    ...new Set(confirmedUtxos.map((utxo) => utxo.txid.toLowerCase())),
  ];
  const previousTransactions = new Map<
    string,
    IZcashParsedTransparentTransaction
  >();
  // Cache only immutable outputs verified against the txid; membership/confirmations/reservations are always refreshed.
  vault.zcashPreviousTransactionsCache ??= new LRUCache<
    string,
    IZcashParsedTransparentTransaction
  >({
    max: 128,
  });
  const cache = vault.zcashPreviousTransactionsCache;
  const missingTxids = txids.filter((txid) => {
    const cached = cache.get(txid);
    if (!cached) return true;
    previousTransactions.set(txid, cached);
    return false;
  });
  if (missingTxids.length) {
    const rawTransactions =
      await vault.backgroundApi.serviceSend.getRawTransactions({
        networkId: vault.networkId,
        txids: missingTxids,
        retries: options?.rawTxRetries,
      });
    const transactions = missingTxids.map((txid) => {
      const rawTx = rawTransactions[txid]?.rawTx;
      if (!rawTx) {
        throw zcashTransparentError(
          'UTXO_SOURCE_UNAVAILABLE',
          'Zcash previous transaction is unavailable',
        );
      }
      return { txid, rawTx };
    });
    const api = await vault.zcashGetApi();
    const parsed = await api.parseTransparentTransactions({ transactions });
    for (const transaction of parsed) {
      previousTransactions.set(transaction.txid, transaction);
      cache.set(transaction.txid, transaction);
    }
  }

  // A signed/signing tx still spends these; both totals and new selections must skip them until it settles or expires.
  const inUse = new Set(
    [
      ...(await vault.backgroundApi.simpleDb.zcash.listTransparentOutpointsInUse(
        { accountId: account.id },
      )),
    ].map((key) => key.toLowerCase()),
  );
  let targetHeight = 0;
  let coinbaseZat = new BigNumber(0);
  const seen = new Set<string>();
  const utxos: IZcashTransparentTxRequest['utxos'] = [];
  for (const utxo of confirmedUtxos) {
    // A new tx lands in the block after the tip (height + confirmations - 1); branch, expiry, maturity key off that.
    targetHeight = Math.max(targetHeight, utxo.height + utxo.confirmations);
    const key = `${utxo.txid.toLowerCase()}:${utxo.vout}`;
    if (seen.has(key) || inUse.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    seen.add(key);

    const previous = previousTransactions.get(utxo.txid.toLowerCase());
    const output = previous?.outputs[utxo.vout];
    const value = new BigNumber(utxo.value);
    if (
      !previous ||
      !output ||
      !/^\d+$/.test(utxo.value) ||
      !value.isFinite() ||
      !value.isInteger() ||
      !value.isEqualTo(output.valueZat)
    ) {
      throw zcashTransparentError(
        'INVALID_TRANSACTION_REQUEST',
        'Zcash UTXO does not match its previous transaction',
      );
    }
    const coinbase = previous.isCoinbase;
    // Counted before the filter drops it: mining rewards are real funds this path can't move, so the token page must show them.
    if (coinbase === true) {
      try {
        coinbaseZat = coinbaseZat.plus(utxo.value);
      } catch {
        // A malformed value is already excluded from every other total.
      }
    }
    const normalizedPath = vault.zcashNormalizeTransparentPath({
      path: utxo.path ?? '',
      accountIndex,
    });
    const { scriptPubKey } = output;
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
    if (!value.isGreaterThan(0)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const valueZat = value.toFixed(0);
    utxos.push({
      txid: utxo.txid.toLowerCase(),
      vout: utxo.vout,
      valueZat,
      scriptPubKey: scriptPubKey.toLowerCase(),
      isCoinbase: false,
      confirmations: utxo.confirmations,
      derivationPath: normalizedPath.derivationPath,
    });
  }
  // No UTXOs means no height to report -- that's an empty wallet, not a broken indexer. Prune treats 0 as undefined.
  if (targetHeight <= 0 && utxos.length > 0) {
    throw zcashTransparentError(
      'CHAIN_HEIGHT_UNAVAILABLE',
      'Zcash chain height is unavailable from the UTXO source',
    );
  }
  return {
    account,
    accountIndex,
    targetHeight,
    utxos,
    coinbaseZat: coinbaseZat.toFixed(0),
  };
}

export async function zcashTransparentChange(
  vault: Vault,
  {
    account,
    accountIndex,
  }: {
    account: IDBUtxoAccount;
    accountIndex: number;
  },
): Promise<{ address: string; derivationPath: string }> {
  const relativePath = '1/0';
  const result = await getAddressFromXpub({
    curve: 'secp256k1',
    network: await vault.getBtcForkNetwork(),
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

export function zcashTransparentRequest(
  vault: Vault,
  {
    accountIndex,
    targetHeight,
    utxos,
    selectedOutpoints,
    toAddress,
    amountZat,
    memoHex,
    sendMax,
    change,
  }: {
    accountIndex: number;
    targetHeight: number;
    utxos: IZcashTransparentTxRequest['utxos'];
    selectedOutpoints: IZcashTransparentOutpoint[];
    toAddress: string;
    amountZat: string;
    memoHex?: string;
    sendMax: boolean;
    change?: IZcashTransparentTxRequest['change'];
  },
): IZcashTransparentTxRequest {
  return {
    network: 'main',
    accountIndex,
    targetHeight,
    expiryHeight: targetHeight + TRANSPARENT_TX_EXPIRY_DELTA,
    utxos,
    selectedOutpoints,
    recipients: [
      {
        address: toAddress,
        amountZat: sendMax ? undefined : amountZat,
        memoHex,
      },
    ],
    sendMax,
    change: sendMax ? undefined : change,
  };
}

export async function zcashBuildTransparentEncodedTx(
  vault: Vault,
  {
    transferInfo,
    sendMax,
  }: {
    transferInfo: NonNullable<IBuildEncodedTxParams['transfersInfo']>[number];
    sendMax: boolean;
  },
): Promise<IEncodedTxZcash> {
  if (!isZcashTransparentPayable(transferInfo.to)) {
    throw zcashTransparentError(
      'UNSUPPORTED_TRANSPARENT_DESTINATION',
      'Transparent funds support t1, t3, TEX and Unified recipients with an Orchard receiver',
    );
  }
  const validation = await vault.validateAddress(transferInfo.to);
  if (!validation.isValid) {
    throw zcashTransparentError(
      'INVALID_ADDRESS',
      'Invalid Zcash transparent address',
    );
  }
  const fresh = await vault.zcashFetchFreshTransparentUtxos();
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
  // Same rule as the BTC vault: requesting more than confirmed regular UTXOs cover is an error, never a silent send-all.
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
    : await vault.zcashTransparentChange({
        account: fresh.account,
        accountIndex: fresh.accountIndex,
      });
  const api = await vault.zcashGetApi();
  let request: IZcashTransparentTxRequest | undefined;
  let quote: IZcashTransparentTxQuote | undefined;
  let lastError: unknown;
  const selectAll = !!selectedKeys?.length || sendMax;
  const attemptCount = selectAll ? 1 : candidates.length;
  for (let index = 0; index < attemptCount; index += 1) {
    // Keep only the current prefix alive across the quote await.
    const selected = selectAll ? candidates : candidates.slice(0, index + 1);
    const selectedOutpoints = selected.map(({ txid, vout }) => ({
      txid,
      vout,
    }));
    const candidateRequest = vault.zcashTransparentRequest({
      accountIndex: fresh.accountIndex,
      targetHeight: fresh.targetHeight,
      // Explicit outpoints make unselected catalog entries irrelevant; don't serialize the whole wallet on every attempt.
      utxos: selected,
      selectedOutpoints,
      toAddress: transferInfo.to,
      memoHex: transferInfo.zcashMemoHex,
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
    throw toUserFacingZcashError(
      lastError ??
        zcashTransparentError(
          'INSUFFICIENT_FUNDS',
          'Insufficient Zcash transparent balance',
        ),
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
      // Display only (confirm page "From"); signing keys off path/outpoint.
      address: zcashTransparentAddressForScript(utxo.scriptPubKey) ?? '',
      path: utxo.derivationPath,
    })),
    outputs: [{ address: transferInfo.to, value: quote.sendAmountZat }],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: quote.feeZat,
    txSize: undefined,
    zcashMode: 'transparent',
    zcashTo: transferInfo.to,
    zcashMemoHex: transferInfo.zcashMemoHex,
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

export async function zcashPrepareFreshTransparentRequest(
  vault: Vault,
  {
    encodedTx,
  }: {
    encodedTx: IEncodedTxZcash;
  },
): Promise<IZcashTransparentTxRequest> {
  const plan = encodedTx.zcashTransparentPlan;
  if (encodedTx.zcashMode !== 'transparent' || !plan) {
    throw zcashTransparentError(
      'INVALID_TRANSPARENT_PLAN',
      'Zcash transparent transaction plan is missing',
    );
  }
  const fresh = await vault.zcashFetchFreshTransparentUtxos();
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
  const request = vault.zcashTransparentRequest({
    accountIndex: fresh.accountIndex,
    targetHeight: fresh.targetHeight,
    utxos: fresh.utxos,
    selectedOutpoints: plan.selectedOutpoints,
    toAddress: encodedTx.zcashTo,
    memoHex: encodedTx.zcashMemoHex,
    amountZat: encodedTx.zcashAmountValue,
    sendMax: plan.sendMax,
    change: plan.change,
  });
  let quote: IZcashTransparentTxQuote;
  try {
    quote = await (await vault.zcashGetApi()).quoteTransparentTx(request);
  } catch (e) {
    throw toUserFacingZcashError(e);
  }
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
