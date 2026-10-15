import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { isShieldedAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import {
  ZCASH_CURRENT_SHIELDED_POOL,
  ZCASH_DECIMALS,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { toUserFacingZcashError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/errorCopy';
import {
  readZcashRuntimeError,
  zcashErrorAmount,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashPcztReservation,
  IZcashSpendSource,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import { validateZcashMemoHex } from '@onekeyhq/shared/src/utils/zcashMemo';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { localWalletText } from '../../localWallet/messages';

import { getZcashLifecycleMutex } from './lifecycle';
import {
  getZcashPcztReviewDigest,
  getZcashPcztReviewRequest,
} from './pcztReview';
import { parseZcashTransaction } from './transactionReview';
import {
  ZCASH_DISPLAY_FEE_ZAT,
  describeZcashBroadcastFailure,
  zcashDescribeError,
  zcashSpendSourceFromKey,
  zcashTrackUserOperation,
  zcashTransparentError,
} from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type {
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IUpdateUnsignedTxParams,
} from '../../types';
import type VaultBtc from '../btc/Vault';

// Frees stale send state: expired transparent journals, and private reservations never signed or past their lock.
export async function zcashReleaseStaleSendState(
  vault: Vault,
  accountId: string,
  excludeShieldedReservationId?: string,
) {
  let [transparentPending, shieldedReservations] = await Promise.all([
    vault.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
      accountId,
    }),
    vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
      accountId,
    }),
  ]);
  await vault.zcashPruneTransparentSendHistory(accountId);
  transparentPending =
    await vault.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
      accountId,
    });
  // Re-read after the indexer await so a fresh reservation can't slip
  // through; only consensus height may expire an abandoned reservation.
  shieldedReservations =
    await vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
      accountId,
    });
  const [meta, privacyModeEnabled] = await Promise.all([
    vault.backgroundApi.simpleDb.zcash.getAccountMeta({ accountId }),
    vault.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({ accountId }),
  ]);
  if (excludeShieldedReservationId) {
    shieldedReservations = shieldedReservations.filter(
      ({ reservationId }) => reservationId !== excludeShieldedReservationId,
    );
  }
  // A PCZT from an abandoned review will never be broadcast; unlock its inputs instead of blocking new sends.
  const abandonedReservations = shieldedReservations.filter(
    ({ state }) => state === 'unsigned',
  );
  if (abandonedReservations.length > 0 && meta) {
    for (const { reservationId } of abandonedReservations) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const account = await vault.zcashGetWalletAccount({ accountId });
        // eslint-disable-next-line no-await-in-loop
        const api = await vault.zcashGetApi();
        // eslint-disable-next-line no-await-in-loop
        await api.releasePczt(account, { reservationId });
        // eslint-disable-next-line no-await-in-loop
        await vault.backgroundApi.simpleDb.zcash.removeShieldedReservation({
          accountId,
          reservationId,
        });
      } catch {
        // Keep the journal and fail closed below.
      }
    }
    shieldedReservations = (
      await vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId,
      })
    ).filter(
      ({ reservationId }) => reservationId !== excludeShieldedReservationId,
    );
  }
  let currentShieldedHeight: number | null = null;
  if (
    shieldedReservations.some(({ expiryHeight }) => expiryHeight !== undefined)
  ) {
    try {
      currentShieldedHeight = await vault.getLocalWalletChainTip();
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
    for (const { reservationId } of expiredShieldedReservations) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const account = await vault.zcashGetWalletAccount({ accountId });
        // eslint-disable-next-line no-await-in-loop
        const api = await vault.zcashGetApi();
        // eslint-disable-next-line no-await-in-loop
        await api.releasePczt(account, { reservationId });
        // eslint-disable-next-line no-await-in-loop
        await vault.backgroundApi.simpleDb.zcash.removeShieldedReservation({
          accountId,
          reservationId,
        });
      } catch {
        // Keep the journal and fail closed; a later retry can release it once the carrier recovers.
      }
    }
    shieldedReservations =
      await vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId,
      });
    if (excludeShieldedReservationId) {
      shieldedReservations = shieldedReservations.filter(
        ({ reservationId }) => reservationId !== excludeShieldedReservationId,
      );
    }
  }
  return {
    transparentPending,
    shieldedReservations,
    meta,
    privacyModeEnabled,
  };
}

export async function zcashAssertNoUnresolvedBroadcast(
  vault: Vault,
  accountId: string,
  excludeShieldedReservationId?: string,
) {
  const { transparentPending, shieldedReservations, meta, privacyModeEnabled } =
    await vault.zcashReleaseStaleSendState(
      accountId,
      excludeShieldedReservationId,
    );
  let privatePendingTxids: string[] = [];
  if (meta && (privacyModeEnabled || shieldedReservations.length > 0)) {
    try {
      const account = await vault.zcashGetWalletAccount({ accountId });
      const api = await vault.zcashGetApi();
      privatePendingTxids = await api.getPendingBroadcasts(account);
    } catch (error) {
      // Scanner may be unreachable; transparent sends and deletion must not depend on it.
      console.warn('[zcash] private broadcast state unavailable', {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const pendingTxids = Array.from(
    new Set([
      ...privatePendingTxids,
      ...transparentPending.map((tx) => tx.txid),
    ]),
  );
  if (pendingTxids.length > 0 || shieldedReservations.length > 0) {
    const error = new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_pending_send__msg),
    );
    Object.assign(error, {
      code: PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE,
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

export async function zcashCreatePczt(
  vault: Vault,
  params: {
    accountId: string;
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    memoHex?: string;
    reservationId?: string;
  },
): Promise<IZcashPcztReservation> {
  // Pending sends don't block new ones: their notes are already spent/locked, so the proposer can't reuse them.
  await vault.zcashReleaseStaleSendState(
    params.accountId,
    params.reservationId,
  );
  const account = await vault.zcashGetWalletAccount({
    accountId: params.accountId,
  });
  const api = await vault.zcashGetApi();
  try {
    return await zcashTrackUserOperation(() =>
      api.createPczt(account, {
        toAddress: params.toAddress,
        valueZat: params.valueZat,
        spendSource: params.spendSource,
        reservationId: params.reservationId,
        memoHex: params.memoHex,
      }),
    );
  } catch (e) {
    // Runtime message is a bare error code; swap in user-facing wording here since the standard proxy toasts `message` directly.
    throw toUserFacingZcashError(e);
  }
}

export async function zcashProvePczt(
  vault: Vault,
  params: {
    accountId: string;
    pcztHex: string;
  },
): Promise<{ pcztHex: string }> {
  const account = await vault.zcashGetWalletAccount({
    accountId: params.accountId,
  });
  const api = await vault.zcashGetApi();
  try {
    return await zcashTrackUserOperation(() =>
      api.provePczt(account, { pcztHex: params.pcztHex }),
    );
  } catch (e) {
    throw toUserFacingZcashError(e);
  }
}

export async function buildEstimateFeeParams(
  vault: Vault,
  params?: {
    encodedTx: IEncodedTx | undefined;
  },
) {
  return { encodedTx: params?.encodedTx };
}

export async function estimateFee(
  vault: Vault,
  params: IEstimateGasParams,
): Promise<IServerEstimateFeeResponse> {
  const network = await vault.getNetwork();
  // Exact ZIP-317 fee via the wasm proposer; falls back to the flat conventional fee when the quote can't run.
  let feeZatValue = ZCASH_DISPLAY_FEE_ZAT;
  const encodedTx = params.encodedTx as IEncodedTxZcash | undefined;
  if (encodedTx?.zcashMode === 'transparent' || encodedTx?.pcztHex) {
    // Fixed at build time: the transparent plan or the locked PCZT's own ZIP-317 fee; no quote beats the proposal itself.
    feeZatValue = encodedTx.fee;
  } else if (
    encodedTx?.zcashTo &&
    encodedTx?.zcashAmountValue &&
    vault.accountId
  ) {
    try {
      const account = await vault.zcashGetWalletAccount({
        accountId: vault.accountId,
      });
      const api = await vault.zcashGetApi();
      const { feeZat } = await api.quotePczt(account, {
        toAddress: encodedTx.zcashTo,
        memoHex: encodedTx.zcashMemoHex,
        valueZat: encodedTx.zcashAmountValue,
        spendSource: encodedTx.zcashSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL,
      });
      feeZatValue = feeZat;
    } catch (e) {
      // User-actionable codes (insufficient funds, invalid address, ...) must surface here, not fall through to the flat-fee guess.
      const runtime = readZcashRuntimeError(e);
      const actionable = [
        'INSUFFICIENT_FUNDS',
        'INVALID_ADDRESS',
        'AMOUNT_OUT_OF_RANGE',
        'INVALID_MEMO',
      ];
      const blocksConfirmation = !!runtime && actionable.includes(runtime.code);
      if (blocksConfirmation) {
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
        // ZIP-317 fee, exact when quoted; feeUtils expects an already-parsed native-unit amount, so convert out of zatoshis here.
        feeUTXO: [
          {
            feeValue: zatoshiToZec(feeZatValue),
          },
        ],
      },
    },
  };
}

export async function buildEncodedTx(
  vault: Vault,
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
  validateZcashMemoHex(transferInfo.zcashMemoHex);
  if (transferInfo.zcashMemoHex && !isShieldedAddress(transferInfo.to)) {
    throw new OneKeyLocalError(
      localWalletText(ETranslations.privacy_memo_shielded_only__msg),
    );
  }
  if (transferInfo.hexData && transferInfo.hexData !== '0x') {
    throw new OneKeyLocalError('Zcash transaction messages are not supported');
  }
  if (!transferInfo.to) {
    throw new OneKeyLocalError(
      'buildEncodedTx ERROR: transferInfo.to is missing',
    );
  }
  const privacyMode =
    await vault.backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId: vault.accountId,
    });
  const sourcePool = transferInfo.localWalletSourcePool;
  const requestedSpendSource = zcashSpendSourceFromKey(
    transferInfo.localWalletSpendSource,
  );
  if (
    privacyMode.intent !== 'on' &&
    (sourcePool === 'orchard' ||
      sourcePool === 'ironwood' ||
      requestedSpendSource !== undefined)
  ) {
    throw zcashTransparentError(
      'PRIVACY_MODE_DISABLED',
      'Enable Zcash Privacy Mode before using a shielded pool',
    );
  }
  // No pool chosen: same default the send page shows -- a transparent recipient is paid from transparent funds.
  const defaultsToTransparent =
    sourcePool === undefined &&
    requestedSpendSource === undefined &&
    !isShieldedAddress(transferInfo.to);
  const buildsTransparentTx =
    transferInfo.localWalletShield ||
    sourcePool === 'transparent' ||
    defaultsToTransparent ||
    privacyMode.intent !== 'on';
  if (buildsTransparentTx) {
    return vault.zcashBuildTransparentEncodedTx({
      transferInfo,
      sendMax:
        transferInfo.localWalletShield === true ||
        params.transferPayload?.isMaxSend === true,
    });
  }
  let amountValue = new BigNumber(transferInfo.amount)
    .shiftedBy(ZCASH_DECIMALS)
    .toFixed(0, BigNumber.ROUND_DOWN);
  // Only an explicit Max request may change the entered amount; ordinary transfers reach the proposer unchanged.
  const spendSource: IZcashSpendSource =
    sourcePool === 'orchard' || sourcePool === 'ironwood'
      ? sourcePool
      : (requestedSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL);
  if (params.transferPayload?.isMaxSend === true) {
    // Notes held by an abandoned review would shrink the max.
    await vault.zcashReleaseStaleSendState(vault.accountId);
    const balanceForMax = await vault.zcashGetBalanceSafe();
    if (!balanceForMax) {
      throw zcashTransparentError(
        'NOT_SYNCED',
        'Zcash spendable balance is unavailable. Refresh before sending Max.',
      );
    }
    const account = await vault.zcashGetWalletAccount({
      accountId: vault.accountId,
    });
    const api = await vault.zcashGetApi();
    // Max spends the chosen pool alone, never topped up with transparent funds, matching what the amount page showed.
    const spendable = new BigNumber(
      balanceForMax.poolsDetail[spendSource].spendable,
    );
    let feeGuess = new BigNumber(ZCASH_DISPLAY_FEE_ZAT);
    let resolved: BigNumber | undefined;
    // Needed so the failure message can cite the exact shortfall instead of a bare 'not enough'.
    let shortfallZat: number | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = spendable.minus(feeGuess);
      if (candidate.lte(0)) {
        if (shortfallZat === null) {
          shortfallZat = feeGuess.minus(spendable).toNumber();
        }
        break;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const { feeZat } = await api.quotePczt(account, {
          toAddress: transferInfo.to,
          memoHex: transferInfo.zcashMemoHex,
          valueZat: candidate.toFixed(0),
          spendSource,
        });
        if (new BigNumber(feeZat).lte(feeGuess)) {
          // Keep the largest: raising the guess later yields smaller ones.
          if (resolved === undefined || candidate.gt(resolved)) {
            resolved = candidate;
          }
          if (new BigNumber(feeZat).eq(feeGuess)) {
            break;
          }
          // The difference is the user's money, but a larger amount may select more inputs, so it needs its own quote.
          feeGuess = new BigNumber(feeZat);
          // eslint-disable-next-line no-continue
          continue;
        }
        feeGuess = new BigNumber(feeZat);
      } catch (e) {
        // An unaffordable probe's INSUFFICIENT_FUNDS carries the exact shortfall -- guidance for the next guess, not a failure.
        const shortfall = zcashErrorAmount(e, 'shortfallZat');
        if (
          readZcashRuntimeError(e)?.code === 'INSUFFICIENT_FUNDS' &&
          shortfall !== null &&
          shortfall > 0
        ) {
          shortfallZat = shortfall;
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
          params:
            shortfallZat !== null && shortfallZat > 0 ? { shortfallZat } : {},
        }),
      );
    }
    amountValue = resolved.toFixed(0);
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
    zcashMemoHex: transferInfo.zcashMemoHex,
    zcashAmountValue: amountValue,
    zcashSpendSource: spendSource,
    zcashMode: 'privacy',
    zcashIsMaxSend: params.transferPayload?.isMaxSend === true,
  };
}

// The generic local-history store keeps only public-side rows for this chain; a transparent send must carry that tag or its pending row is dropped.
export async function buildHistoryTx(
  vault: Vault,
  params: Parameters<VaultBtc['buildHistoryTx']>[0],
): Promise<IAccountHistoryTx> {
  const historyTx = await vault.baseBuildHistoryTx(params);
  const encodedTx = historyTx.decodedTx.encodedTx as
    | IEncodedTxZcash
    | undefined;
  if (encodedTx?.zcashMode === 'transparent') {
    const signedExpiry = (
      params.signedTx?.encodedTx as IEncodedTxZcash | undefined
    )?.zcashTransparentBuild?.expiryHeight;
    const publicEncodedTx: IEncodedTxZcash = {
      ...encodedTx,
      zcashMemoHex: undefined,
      expiry: signedExpiry ?? encodedTx.expiry,
    };
    return {
      ...historyTx,
      decodedTx: {
        ...historyTx.decodedTx,
        // Shielded memo plaintext must never enter the generic public history cache; confirmed memos are decrypted by the runtime.
        encodedTx: publicEncodedTx,
      },
      privacyChainHistorySide: 'public',
      privacyChainHistoryPoolIds: [0],
    };
  }
  // Every locally built row is tagged: private rows must never reach the shared local-history cache.
  return { ...historyTx, privacyChainHistorySide: 'private' };
}

export async function buildDecodedTx(
  vault: Vault,
  params: IBuildDecodedTxParams,
): Promise<IDecodedTx> {
  const { unsignedTx } = params;
  const encodedTx = parseZcashTransaction(unsignedTx.encodedTx);
  if (encodedTx.zcashMode === 'privacy') {
    await vault.zcashAssertPcztReservationLive({
      accountId: vault.accountId,
      reservationId: checkIsDefined(encodedTx.pcztReservationId),
      encodedTx,
    });
  }
  const network = await vault.getNetwork();
  const account = await vault.getAccount();

  const nativeToken = await vault.backgroundApi.serviceToken.getToken({
    accountId: vault.accountId,
    networkId: vault.networkId,
    tokenIdOnNetwork: '',
  });

  const amount = zatoshiToZec(encodedTx.zcashAmountValue);

  let action: IDecodedTx['actions'][0] = {
    type: EDecodedTxActionType.UNKNOWN,
    unknownAction: {
      from: account.address,
      to: encodedTx.zcashTo,
    },
  };

  if (nativeToken) {
    action = await vault.buildTxTransferAssetAction({
      from: account.address,
      to: encodedTx.zcashTo,
      transfers: [
        {
          from: account.address,
          to: encodedTx.zcashTo,
          // Always the amount the tx will actually carry: max-send/shielding converge it here, so the UI figure can be stale.
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
    networkId: vault.networkId,
    accountId: vault.accountId,
    extraInfo: null,
    encodedTx,
    totalFeeInNative: new BigNumber(encodedTx.fee || '0')
      .shiftedBy(-network.decimals)
      .toFixed(),
    nativeAmount: amount,
    nativeAmountValue: encodedTx.zcashAmountValue,
    // A PCZT's inputs/fee are already fixed and its notes locked; the confirm page's generic balance check would otherwise flag them unavailable.
    isPsbt: !!encodedTx.pcztHex,
  };
}

export async function buildUnsignedTx(
  vault: Vault,
  params: IBuildUnsignedTxParams,
): Promise<IUnsignedTxPro> {
  const encodedTx = await vault.buildEncodedTx(params);
  const unsignedTx: IUnsignedTxPro = {
    encodedTx,
    transfersInfo: params.transfersInfo ?? [],
  };
  if (encodedTx.zcashMode !== 'privacy' || !vault.accountId) {
    return unsignedTx;
  }
  const withPczt = await vault.zcashAttachPczt(encodedTx);
  return { ...unsignedTx, encodedTx: withPczt };
}

// Built here, not at signing, so review shows the exact locked proposal.
// Journal is written before the runtime locks notes, so a crash stays releasable.
export async function zcashAttachPczt(
  vault: Vault,
  encodedTx: IEncodedTxZcash,
): Promise<IEncodedTxZcash> {
  const accountId = vault.accountId;
  const meta = await vault.backgroundApi.simpleDb.zcash.getAccountMeta({
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
      await vault.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
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
    const expiryHeight = await vault.zcashGetShieldedReservationExpiryHeight();
    await vault.backgroundApi.simpleDb.zcash.saveShieldedReservation({
      accountId,
      reservationId,
      expiryHeight,
      state: 'unsigned',
    });
    let created: IZcashPcztReservation;
    try {
      created = await vault.zcashCreatePczt({
        accountId,
        toAddress: encodedTx.zcashTo,
        memoHex: encodedTx.zcashMemoHex,
        valueZat: encodedTx.zcashAmountValue,
        spendSource: encodedTx.zcashSpendSource ?? ZCASH_CURRENT_SHIELDED_POOL,
        reservationId,
      });
      if (created.reservationId !== reservationId) {
        throw new OneKeyLocalError(
          'zcash: runtime returned an unexpected reservation id',
        );
      }
    } catch (error) {
      await vault.zcashAbandonPczt({ accountId, reservationId }).catch(() => {
        // A carrier failure may happen after the runtime reservation; keep the host journal until an explicit release succeeds.
      });
      throw error;
    }
    const amountValue = encodedTx.zcashAmountValue;
    const reviewed: IEncodedTxZcash = {
      ...encodedTx,
      fee: created.feeZat,
      zcashAmountValue: amountValue,
      outputs: encodedTx.outputs.map((output, index) =>
        index === 0 ? { ...output, value: amountValue } : output,
      ),
      pcztHex: created.pcztHex,
      pcztReservationId: reservationId,
    };
    try {
      const api = await vault.zcashGetApi();
      await api.verifyPcztReview({
        pcztHex: created.pcztHex,
        review: getZcashPcztReviewRequest(reviewed, meta.ufvk),
      });
      await vault.backgroundApi.simpleDb.zcash.saveShieldedReservation({
        accountId,
        reservationId,
        expiryHeight,
        state: 'unsigned',
        reviewDigest: getZcashPcztReviewDigest({
          accountId,
          networkId: vault.networkId,
          encodedTx: reviewed,
          ufvk: meta.ufvk,
        }),
      });
      return reviewed;
    } catch (error) {
      await vault
        .zcashAbandonPczt({ accountId, reservationId })
        .catch(() => undefined);
      throw error;
    }
  });
}

export async function zcashAssertPcztReservationLive(
  vault: Vault,
  params: {
    accountId: string;
    reservationId: string;
    encodedTx: IEncodedTxZcash;
  },
): Promise<void> {
  const reservations =
    await vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
      accountId: params.accountId,
    });
  const reservation = reservations.find(
    ({ reservationId }) => reservationId === params.reservationId,
  );
  // Signed already means a submit was attempted whose outcome never came
  // back; "review again" would lead the user into paying a second time.
  if (reservation?.state === 'signed') {
    throw Object.assign(
      new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_broadcast_unknown__msg),
      ),
      { code: 'FINALIZE_OUTCOME_UNKNOWN', params: {} },
    );
  }
  const meta = await vault.backgroundApi.simpleDb.zcash.getAccountMeta({
    accountId: params.accountId,
  });
  if (
    params.accountId !== vault.accountId ||
    params.encodedTx.pcztReservationId !== params.reservationId ||
    !reservation ||
    !meta ||
    !reservation.reviewDigest ||
    reservation.reviewDigest !==
      getZcashPcztReviewDigest({
        accountId: params.accountId,
        networkId: vault.networkId,
        encodedTx: params.encodedTx,
        ufvk: meta.ufvk,
      })
  ) {
    throw Object.assign(
      new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_review_expired__msg),
      ),
      { code: 'STALE_PRIVACY_TRANSACTION', params: {} },
    );
  }
}

export async function zcashPreparePcztForSigning(
  vault: Vault,
  params: {
    accountId: string;
    reservationId: string;
    pcztHex: string;
    encodedTx: IEncodedTxZcash;
  },
): Promise<{ pcztHex: string }> {
  if (params.pcztHex !== params.encodedTx.pcztHex) {
    throw new OneKeyLocalError(
      'zcash: transaction proposal does not match the review',
    );
  }
  await vault.zcashAssertPcztReservationLive(params);
  return vault.zcashProvePczt({
    accountId: params.accountId,
    pcztHex: params.pcztHex,
  });
}

export async function zcashCombineSignedPczt(
  vault: Vault,
  params: {
    accountId: string;
    originalPcztHex: string;
    signedPcztHex: string;
  },
): Promise<{ pcztHex: string }> {
  const api = await vault.zcashGetApi();
  try {
    return await api.combinePczt({
      originalPcztHex: params.originalPcztHex,
      signedPcztHex: params.signedPcztHex,
    });
  } catch (e) {
    throw toUserFacingZcashError(e);
  }
}

// The transparent outputs a signed tx pays, checked against what was reviewed before the tx is kept.
export async function zcashParseTransparentOutputs(
  vault: Vault,
  result: {
    txid: string;
    rawTx: string;
  },
): Promise<{ valueZat: string; scriptPubKey: string }[]> {
  const api = await vault.zcashGetApi();
  const [parsed] = await api.parseTransparentTransactions({
    transactions: [{ txid: result.txid, rawTx: result.rawTx }],
  });
  if (!parsed) {
    throw new OneKeyLocalError(
      'zcash: the signed transaction could not be read',
    );
  }
  return parsed.outputs;
}

// Cleanup for a PCZT that never got signed. Once journaled as signed,
// inputs stay reserved (ADR 0002) until the outcome is known or it expires.
export async function releaseUnsignedTx(
  vault: Vault,
  {
    unsignedTx,
  }: {
    unsignedTx: IUnsignedTxPro;
  },
): Promise<void> {
  const value = unsignedTx.encodedTx;
  const reservationId =
    value &&
    typeof value === 'object' &&
    'pcztReservationId' in value &&
    typeof value.pcztReservationId === 'string'
      ? value.pcztReservationId
      : undefined;
  if (!reservationId || !vault.accountId) return;
  const meta = await vault.backgroundApi.simpleDb.zcash.getAccountMeta({
    accountId: vault.accountId,
  });
  await getZcashLifecycleMutex(meta?.ufvk ?? vault.accountId).runExclusive(() =>
    vault.zcashAbandonPczt({ accountId: vault.accountId, reservationId }),
  );
}

export async function zcashAbandonPczt(
  vault: Vault,
  params: {
    accountId: string;
    reservationId: string;
  },
): Promise<void> {
  const reservations =
    await vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
      accountId: params.accountId,
    });
  const signed = reservations.some(
    ({ reservationId, state }) =>
      reservationId === params.reservationId && state === 'signed',
  );
  if (signed) {
    console.warn('[zcash] keeping a signed reservation after a failure', {
      accountId: params.accountId,
    });
    return;
  }
  await vault.zcashReleasePczt(params);
  await vault.backgroundApi.simpleDb.zcash.removeShieldedReservation(params);
}

export async function updateUnsignedTx(
  vault: Vault,
  params: IUpdateUnsignedTxParams,
): Promise<IUnsignedTxPro> {
  const feeValue = params.feeInfo?.feeUTXO?.feeValue;
  if (feeValue === undefined) {
    return params.unsignedTx;
  }
  const network = await vault.getNetwork();
  const encodedTx = params.unsignedTx.encodedTx as IEncodedTxZcash;
  // Transparent fee is fixed at build; a PCZT carries its own exact fee.
  if (encodedTx.zcashMode === 'transparent' || encodedTx.pcztHex) {
    return params.unsignedTx;
  }
  const fee = new BigNumber(feeValue)
    .shiftedBy(network.feeMeta.decimals)
    .toFixed(0);
  return {
    ...params.unsignedTx,
    encodedTx: {
      ...encodedTx,
      fee,
    },
  };
}

export async function broadcastTransaction(
  vault: Vault,
  params: IBroadcastTransactionParams,
): Promise<ISignedTxPro> {
  const { signedTx } = params;
  const encodedTx = signedTx.encodedTx as IEncodedTxZcash | undefined;
  if (encodedTx?.zcashMode === 'transparent') {
    const expectedTxid = encodedTx.zcashTransparentBuild?.txid;
    if (
      !expectedTxid ||
      signedTx.txid.toLowerCase() !== expectedTxid.toLowerCase() ||
      signedTx.rawTx !== encodedTx.zcashTransparentBuild?.rawTx
    ) {
      throw zcashTransparentError(
        'INVALID_SIGNED_TRANSACTION',
        'Zcash transparent signed transaction is incomplete',
      );
    }
    await vault.backgroundApi.simpleDb.zcash.authorizeTransparentPendingTx({
      accountId: vault.accountId,
      txid: expectedTxid,
      rawTx: signedTx.rawTx,
    });
    let broadcast: ISignedTxPro;
    try {
      broadcast = await vault.zcashBroadcastTransparentViaBackend(params);
    } catch (e) {
      // A 4xx here doesn't prove rejection -- it can follow a successful upstream
      // submission. Keep outpoints locked until history is terminal or expired.
      const detail = describeZcashBroadcastFailure(e);
      console.error('[zcash] transparent broadcast outcome unknown', {
        txid: expectedTxid,
        ...detail,
      });
      // Reported as submitted: the journal keeps it pending and rebroadcasts it.
      // An error here would invite a resend from other inputs -- a double pay.
      return {
        ...signedTx,
        txid: expectedTxid,
        broadcastOutcomeUnknown: true,
      };
    }
    if (broadcast.txid.toLowerCase() !== expectedTxid.toLowerCase()) {
      throw zcashTransparentError(
        'TXID_MISMATCH',
        'Zcash backend returned an unexpected transaction id',
        { expectedTxid, actualTxid: broadcast.txid },
      );
    }
    await vault.backgroundApi.simpleDb.zcash
      .markTransparentPendingTxAccepted({
        accountId: vault.accountId,
        txid: expectedTxid,
      })
      .catch(() => undefined);
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
  const account = await vault.zcashGetWalletAccount({
    accountId: vault.accountId,
  });
  const api = await vault.zcashGetApi();
  const lifecycleMutex = getZcashLifecycleMutex(account.ufvk);
  const sendResult = await lifecycleMutex.runExclusive(async () => {
    const [privacyModeEnabled, shieldedReservations] = await Promise.all([
      vault.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
        accountId: vault.accountId,
      }),
      vault.backgroundApi.simpleDb.zcash.listShieldedReservations({
        accountId: vault.accountId,
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
          localWalletText(ETranslations.privacy_error_review_expired__msg),
        ),
        { code: 'STALE_PRIVACY_TRANSACTION', params: {} },
      );
    }
    let submitted: Awaited<ReturnType<typeof api.submitPczt>>;
    try {
      submitted = await zcashTrackUserOperation(() =>
        api.submitPczt(account, {
          pcztHex: signedPcztHex,
          reservationId,
        }),
      );
    } catch (e) {
      const runtimeError = readZcashRuntimeError(e);
      if (runtimeError && runtimeError.code !== 'FINALIZE_OUTCOME_UNKNOWN') {
        try {
          await api.releasePczt(account, { reservationId });
          await vault.backgroundApi.simpleDb.zcash.removeShieldedReservation({
            accountId: vault.accountId,
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
      // Carrier may fail after the runtime committed the spend but before the
      // txid returned; don't unlock -- the tx may still be rebroadcast from history.
      const uncertain = new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_broadcast_unknown__msg),
      );
      Object.assign(uncertain, {
        code: 'FINALIZE_OUTCOME_UNKNOWN',
        params: {},
      });
      throw uncertain;
    }
    // The durable runtime record owns the notes, including rejections; host cleanup can't turn a submitted tx into a failure.
    // An unknown outcome keeps the host record until expiry: it is the only
    // trace that survives a runtime database rebuild, and deleting data
    // while the tx may still land could lead to paying twice.
    if (submitted.broadcastState !== 'unknown') {
      await vault.backgroundApi.simpleDb.zcash
        .removeShieldedReservation({
          accountId: vault.accountId,
          reservationId,
        })
        .catch(() => undefined);
    }
    return submitted;
  });
  const { txid, broadcastState, broadcastError } = sendResult;
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
    broadcastOutcomeUnknown: broadcastState === 'unknown',
  };
}
