import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  BINANCE_DEPOSIT_API_PREFIX,
  BINANCE_DEPOSIT_POLL_INTERVAL_MS,
  BINANCE_DEPOSIT_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_TOKEN_REGEX,
  EBinanceDepositLocalErrorCode,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import {
  findBinanceDepositAsset,
  generateBinanceDepositSessionKey,
  getBinanceDepositPhase,
  getBinanceDepositReturnDeadline,
  isAllowedBinanceDepositLink,
  isBinanceDepositAwaitingReturn,
  isBinanceDepositResumable,
  isSameBinanceDepositAddress,
  isSameBinanceDepositDestination,
  normalizeBinanceDepositTxHash,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAsset,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositFailReason,
  IBinanceDepositLocalSession,
  IBinanceDepositSessionView,
  IBinanceDepositSnapshot,
} from '@onekeyhq/shared/types/exchange';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

// expo-secure-store only accepts keys matching ^[\w.-]+$.
const SESSION_KEY_STORAGE_PREFIX = 'onekey_bcd_sk.';
// Create may wait on two upstream calls of 30 seconds each.
const CREATE_TIMEOUT_MS = 75_000;
const REPORT_RETRY_DELAYS_MS = [0, 5000, 15_000, 45_000, 120_000, 300_000];
// The server issues the id as 32 random bytes in lowercase hex. It is checked
// before it is ever put into a request path.
const SESSION_ID_REGEX = /^[0-9a-f]{64}$/;

// The server never moves a session backwards: a view ranked below the stored
// status is a stale response that arrived late.
const STATUS_RANK: Record<IBinanceDepositLocalSession['status'], number> = {
  LOCAL_PENDING_CREATE: 0,
  [EBinanceDepositSessionStatus.CREATING]: 1,
  [EBinanceDepositSessionStatus.INIT]: 2,
  [EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND]: 3,
  [EBinanceDepositSessionStatus.AUTHORIZED]: 4,
  [EBinanceDepositSessionStatus.REJECTED]: 5,
  [EBinanceDepositSessionStatus.EXPIRED]: 5,
  [EBinanceDepositSessionStatus.SECURITY_CONFLICT]: 5,
};

const PENDING_VIEW_STATUSES: ReadonlySet<EBinanceDepositSessionStatus> =
  new Set([
    EBinanceDepositSessionStatus.CREATING,
    EBinanceDepositSessionStatus.INIT,
    EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
  ]);

type IRequestResult =
  | { ok: true; data: unknown }
  // `code` is absent when no business verdict came back.
  | { ok: false; code?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function pickTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function isSessionStatus(
  value: unknown,
): value is EBinanceDepositSessionStatus {
  return (
    typeof value === 'string' &&
    (Object.values(EBinanceDepositSessionStatus) as string[]).includes(value)
  );
}

function parseDestination(
  data: unknown,
): IBinanceDepositAuthorizedDestination | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const networkId = pickString(data.networkId);
  const binanceNetwork = pickString(data.binanceNetwork);
  const cryptoCurrency = pickString(data.cryptoCurrency);
  const address = pickString(data.address);
  const authorizedAt = pickTimestamp(data.authorizedAt);
  if (
    !networkId ||
    !binanceNetwork ||
    !cryptoCurrency ||
    !address ||
    !authorizedAt
  ) {
    return undefined;
  }
  return {
    networkId,
    binanceNetwork,
    cryptoCurrency,
    address,
    authorizedAt,
    contractAddress: pickString(data.contractAddress),
    minAmount:
      typeof data.minAmount === 'number'
        ? String(data.minAmount)
        : pickString(data.minAmount),
    addressTag: pickString(data.addressTag),
  };
}

// The response body is untrusted: only a view with the expected shape, and
// for an existing session the expected id, is accepted.
function parseSessionView(
  data: unknown,
  expectedSessionId?: string,
): IBinanceDepositSessionView | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const { sessionId, status } = data;
  const networkId = pickString(data.networkId);
  const cryptoCurrency = pickString(data.cryptoCurrency);
  if (
    typeof sessionId !== 'string' ||
    !SESSION_ID_REGEX.test(sessionId) ||
    (expectedSessionId !== undefined && sessionId !== expectedSessionId) ||
    !isSessionStatus(status) ||
    !networkId ||
    !cryptoCurrency
  ) {
    return undefined;
  }
  return {
    sessionId,
    status,
    networkId,
    cryptoCurrency,
    contractAddress: pickString(data.contractAddress),
    link: pickString(data.link),
    linkExpireTime: pickTimestamp(data.linkExpireTime),
    bindDeadline: pickTimestamp(data.bindDeadline),
    authorizedDestination: parseDestination(data.authorizedDestination),
  };
}

function isSameAsset(
  session: IBinanceDepositLocalSession,
  item: { networkId: string; cryptoCurrency: string; contractAddress?: string },
): boolean {
  const a = session.contractAddress ?? '';
  const b = item.contractAddress ?? '';
  return (
    item.networkId === session.networkId &&
    item.cryptoCurrency === session.cryptoCurrency &&
    (a && b
      ? isSameBinanceDepositAddress({ networkId: session.networkId, a, b })
      : a === b)
  );
}

// Folds a server view into the local session. A failed session is never
// revived, and anything that does not match the asset of the session, or
// differs from a destination already released, is a conflict.
function mergeView(
  session: IBinanceDepositLocalSession,
  view: IBinanceDepositSessionView,
): IBinanceDepositLocalSession {
  if (
    session.failReason ||
    STATUS_RANK[view.status] < STATUS_RANK[session.status]
  ) {
    return session;
  }
  const next: IBinanceDepositLocalSession = {
    ...session,
    sessionId: view.sessionId,
    status: view.status,
    createFailed: false,
  };
  const fail = (failReason: IBinanceDepositFailReason) => ({
    ...next,
    destination: undefined,
    failReason,
  });
  if (!isSameAsset(session, view)) {
    return fail('conflict');
  }
  switch (view.status) {
    case EBinanceDepositSessionStatus.INIT:
      if (view.link && !isAllowedBinanceDepositLink(view.link)) {
        return fail('conflict');
      }
      return {
        ...next,
        linkExpireTime: view.linkExpireTime ?? session.linkExpireTime,
      };
    case EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND:
      return {
        ...next,
        bindDeadline: view.bindDeadline ?? session.bindDeadline,
      };
    case EBinanceDepositSessionStatus.AUTHORIZED: {
      const destination = view.authorizedDestination;
      if (
        !destination ||
        !isSameAsset(session, destination) ||
        (session.requiresAddressTag && !destination.addressTag) ||
        (session.destination &&
          !isSameBinanceDepositDestination(session.destination, destination))
      ) {
        return fail('conflict');
      }
      return { ...next, destination };
    }
    case EBinanceDepositSessionStatus.REJECTED:
      return fail('rejected');
    case EBinanceDepositSessionStatus.EXPIRED:
      return fail('expired');
    case EBinanceDepositSessionStatus.SECURITY_CONFLICT:
      return fail('conflict');
    default:
      return next;
  }
}

@backgroundClass()
class ServiceBinanceDeposit extends ServiceBase {
  // Memory only: the link is a bearer credential and is never persisted.
  private memoryLink: { localId: string; link: string } | undefined;

  // A bind is running or about to start; further returns are dropped.
  private bindPending = false;

  private lastQueryAt = 0;

  @backgroundMethod()
  async getDepositAsset(params: {
    networkId: string;
    symbol: string;
    contractAddress?: string;
    isNative: boolean;
  }): Promise<IBinanceDepositAsset | undefined> {
    try {
      const assets =
        await this.backgroundApi.serviceToken.getBinanceSupportedAssets();
      return findBinanceDepositAsset({ assets, ...params });
    } catch {
      return undefined;
    }
  }

  // A new session gets a new key. An unfinished one for the same asset is
  // picked up instead: the server would refuse a second one until it expires.
  @backgroundMethod()
  async startSession(
    asset: IBinanceDepositAsset,
  ): Promise<IBinanceDepositSnapshot> {
    const existing =
      await this.backgroundApi.simpleDb.binanceDeposit.getSession();
    if (existing && isBinanceDepositResumable(existing, asset, Date.now())) {
      return this.toSnapshot(existing);
    }
    await this.discardSession();
    const localId = generateUUID();
    const sessionKey = generateBinanceDepositSessionKey();
    if (!(await this.storeSessionKey(localId, sessionKey))) {
      throw this.buildError(EBinanceDepositLocalErrorCode.StorageUnavailable);
    }
    const now = Date.now();
    const session: IBinanceDepositLocalSession = {
      localId,
      networkId: asset.networkId,
      cryptoCurrency: asset.cryptoCurrency,
      contractAddress: asset.contractAddress,
      requiresAddressTag: asset.requiresAddressTag,
      status: 'LOCAL_PENDING_CREATE',
      createdAt: now,
      updatedAt: now,
    };
    await this.backgroundApi.simpleDb.binanceDeposit.setSession(session);
    return this.runCreate(session, sessionKey);
  }

  // Reuses the key of the first attempt, so a create that timed out here but
  // landed on the server maps to that same session.
  @backgroundMethod()
  async retryCreate(localId: string): Promise<IBinanceDepositSnapshot> {
    const session = await this.getSession(localId);
    if (!session) {
      throw this.buildError(EBinanceDepositLocalErrorCode.InvalidState);
    }
    if (session.status !== 'LOCAL_PENDING_CREATE') {
      return this.toSnapshot(session);
    }
    const sessionKey = await this.readSessionKey(localId);
    if (!sessionKey) {
      throw this.buildError(EBinanceDepositLocalErrorCode.StorageUnavailable);
    }
    return this.runCreate(session, sessionKey);
  }

  private async runCreate(
    session: IBinanceDepositLocalSession,
    sessionKey: string,
  ): Promise<IBinanceDepositSnapshot> {
    const { localId } = session;
    await this.updateSession(localId, (s) => ({ ...s, createFailed: false }));
    const body: Record<string, string> = {
      sessionKey,
      networkId: session.networkId,
      cryptoCurrency: session.cryptoCurrency,
    };
    if (session.contractAddress) {
      body.contractAddress = session.contractAddress;
    }
    const result = await this.request(
      '/deposit/sessions',
      body,
      CREATE_TIMEOUT_MS,
    );
    const view = result.ok ? parseSessionView(result.data) : undefined;
    if (
      !view &&
      (result.ok ||
        result.code === undefined ||
        result.code === EBinanceDepositErrorCode.ServiceError)
    ) {
      // No verdict: the session and its key stay for a retry.
      return this.toSnapshot(
        await this.updateSession(localId, (s) => ({
          ...s,
          createFailed: true,
        })),
      );
    }
    if (!view) {
      await this.discardSession(localId);
      if (
        !result.ok &&
        result.code === EBinanceDepositErrorCode.CapabilityStale
      ) {
        void this.backgroundApi.serviceToken._getBinanceSupportedAssetsMemo.clear();
      }
      throw this.buildError(result.ok ? undefined : result.code);
    }
    return this.toSnapshot(await this.applyView(localId, view));
  }

  @backgroundMethod()
  async prepareOpenLink(localId: string): Promise<{ link: string }> {
    let session = await this.getSession(localId);
    if (
      session?.status === EBinanceDepositSessionStatus.INIT &&
      this.memoryLink?.localId !== localId
    ) {
      // Lost with a background restart; the INIT view carries it again.
      session = await this.querySession(session);
    }
    const link =
      this.memoryLink?.localId === localId ? this.memoryLink.link : undefined;
    if (
      !session ||
      session.status !== EBinanceDepositSessionStatus.INIT ||
      session.failReason ||
      !link
    ) {
      throw this.buildError(EBinanceDepositLocalErrorCode.InvalidState);
    }
    if (session.linkExpireTime && session.linkExpireTime <= Date.now()) {
      await this.failSession(localId, 'expired');
      throw this.buildError(EBinanceDepositLocalErrorCode.InvalidState);
    }
    // Recorded before the link leaves: only then is a return accepted.
    await this.updateSession(localId, (s) => ({
      ...s,
      linkOpenedAt: s.linkOpenedAt ?? Date.now(),
    }));
    return { link };
  }

  @backgroundMethod()
  async handleDepositReturn({
    returnNonce,
  }: {
    returnNonce: string;
  }): Promise<void> {
    if (!BINANCE_DEPOSIT_TOKEN_REGEX.test(returnNonce) || this.bindPending) {
      return;
    }
    this.bindPending = true;
    let handedOff = false;
    try {
      const session =
        await this.backgroundApi.simpleDb.binanceDeposit.getSession();
      if (!session || !isBinanceDepositAwaitingReturn(session, Date.now())) {
        return;
      }
      await this.updateSession(session.localId, (s) => ({
        ...s,
        returnReceivedAt: Date.now(),
      }));
      // Not awaited: the bind may be retried for minutes.
      handedOff = true;
      void this.runBind(session.localId, returnNonce).finally(() => {
        this.bindPending = false;
      });
    } finally {
      if (!handedOff) {
        this.bindPending = false;
      }
    }
  }

  private async runBind(localId: string, returnNonce: string): Promise<void> {
    for (;;) {
      const session = await this.getSession(localId);
      if (!session?.sessionId || session.destination || session.failReason) {
        return;
      }
      if (Date.now() >= getBinanceDepositReturnDeadline(session)) {
        await this.failSession(localId, 'expired');
        return;
      }
      const sessionKey = await this.readSessionKey(localId);
      const result = sessionKey
        ? await this.request(`/deposit/sessions/${session.sessionId}/bind`, {
            sessionKey,
            returnNonce,
          })
        : undefined;
      if (result?.ok) {
        const view = parseSessionView(result.data, session.sessionId);
        if (view) {
          await this.applyView(localId, view);
          // INIT: the authorization is not confirmed yet; the same nonce is
          // tried again after the server's cooldown.
          if (!PENDING_VIEW_STATUSES.has(view.status)) {
            return;
          }
        }
      } else if (result?.code === EBinanceDepositErrorCode.BindProofInvalid) {
        await this.failSession(localId, 'bind_invalid');
        return;
      } else if (
        result?.code !== undefined &&
        result.code !== EBinanceDepositErrorCode.DepositDisabled &&
        result.code !== EBinanceDepositErrorCode.ServiceError
      ) {
        await this.failSession(localId, 'session_lost');
        return;
      }
      // An INIT view, 14002 (the nonce stays valid), a service error or no
      // verdict: try again until the deadline.
      await timerUtils.wait(BINANCE_DEPOSIT_RETRY_INTERVAL_MS);
    }
  }

  // Local read; asks the server at most every few seconds while the session
  // waits for the authorization.
  @backgroundMethod()
  async getSnapshot(
    localId: string,
  ): Promise<IBinanceDepositSnapshot | undefined> {
    let session = await this.getSession(localId);
    if (session?.sessionId && !session.failReason && !session.destination) {
      const now = Date.now();
      if (now >= getBinanceDepositReturnDeadline(session)) {
        session = await this.failSession(localId, 'expired');
      } else if (
        !this.bindPending &&
        now - this.lastQueryAt >= BINANCE_DEPOSIT_POLL_INTERVAL_MS
      ) {
        session = await this.querySession(session);
      }
    }
    return session ? this.toSnapshot(session) : undefined;
  }

  // Runs on the confirm page right before signing: the transfer has to go to
  // the destination the user saw, and the server has to still release it.
  @backgroundMethod()
  async verifyBeforeSign({
    localId,
    toAddress,
    memo,
  }: {
    localId: string;
    toAddress: string;
    memo?: string;
  }): Promise<void> {
    const session = await this.getSession(localId);
    const shown = session?.destination;
    const sessionKey = await this.readSessionKey(localId);
    if (
      !session?.sessionId ||
      !shown ||
      session.failReason ||
      !sessionKey ||
      !isSameBinanceDepositAddress({
        networkId: session.networkId,
        a: toAddress,
        b: shown.address,
      }) ||
      (memo ?? '') !== (shown.addressTag ?? '')
    ) {
      throw this.buildError(EBinanceDepositLocalErrorCode.VerifyFailed);
    }
    const result = await this.request(
      `/deposit/sessions/${session.sessionId}/query`,
      { sessionKey },
    );
    const view = result.ok
      ? parseSessionView(result.data, session.sessionId)
      : undefined;
    if (
      view?.status === EBinanceDepositSessionStatus.AUTHORIZED &&
      view.authorizedDestination &&
      isSameBinanceDepositDestination(view.authorizedDestination, shown)
    ) {
      return;
    }
    if (view) {
      // A conflict or a changed destination also closes the session.
      await this.failSession(localId, 'conflict');
    }
    throw this.buildError(EBinanceDepositLocalErrorCode.VerifyFailed);
  }

  // Best effort, after the broadcast. Retried in the background while the
  // app runs; the transaction itself is never sent again.
  @backgroundMethod()
  async reportDeposit({
    localId,
    txid,
    senderAddress,
  }: {
    localId: string;
    txid: string;
    senderAddress: string;
  }): Promise<void> {
    const session = await this.getSession(localId);
    const sessionKey = await this.readSessionKey(localId);
    if (!session?.sessionId || !session.destination || !sessionKey || !txid) {
      return;
    }
    // A sign-only transaction id is not on chain, and the server keeps only
    // the first hash it is given.
    const devSettings = await devSettingsPersistAtom.get();
    if (devSettings.enabled && devSettings.settings?.alwaysSignOnlySendTx) {
      return;
    }
    void this.runReport({
      localId,
      sessionId: session.sessionId,
      body: {
        sessionKey,
        txHash: normalizeBinanceDepositTxHash({
          networkId: session.networkId,
          txid,
        }),
        senderAddress,
      },
    });
  }

  private async runReport({
    localId,
    sessionId,
    body,
  }: {
    localId: string;
    sessionId: string;
    body: Record<string, string>;
  }) {
    for (const delayMs of REPORT_RETRY_DELAYS_MS) {
      if (delayMs) {
        await timerUtils.wait(delayMs);
      }
      const result = await this.request(
        `/deposit/sessions/${sessionId}/report`,
        body,
      );
      const isRetryable =
        !result.ok &&
        (result.code === undefined ||
          result.code === EBinanceDepositErrorCode.ServiceError);
      // Accepted, or a final verdict such as 14005.
      if (!isRetryable) {
        break;
      }
    }
    await this.discardSession(localId);
  }

  @backgroundMethod()
  async discardSession(localId?: string): Promise<void> {
    const session =
      await this.backgroundApi.simpleDb.binanceDeposit.getSession();
    if (!session || (localId && session.localId !== localId)) {
      return;
    }
    if (this.memoryLink?.localId === session.localId) {
      this.memoryLink = undefined;
    }
    await this.backgroundApi.simpleDb.binanceDeposit.setSession(undefined);
    await this.removeSessionKey(session.localId);
  }

  // ---- internals ----

  private async querySession(
    session: IBinanceDepositLocalSession,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    const sessionKey = await this.readSessionKey(session.localId);
    if (!session.sessionId || !sessionKey) {
      return session;
    }
    this.lastQueryAt = Date.now();
    const result = await this.request(
      `/deposit/sessions/${session.sessionId}/query`,
      { sessionKey },
    );
    if (result.ok) {
      const view = parseSessionView(result.data, session.sessionId);
      return view ? this.applyView(session.localId, view) : session;
    }
    // `session not found`: the server no longer knows this key.
    if (result.code === EBinanceDepositErrorCode.InvalidParams) {
      return this.failSession(session.localId, 'session_lost');
    }
    return session;
  }

  private async applyView(
    localId: string,
    view: IBinanceDepositSessionView,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    const session = await this.updateSession(localId, (s) =>
      mergeView(s, view),
    );
    if (
      session?.status === EBinanceDepositSessionStatus.INIT &&
      !session.failReason &&
      view.link
    ) {
      this.memoryLink = { localId, link: view.link };
    } else if (this.memoryLink?.localId === localId) {
      this.memoryLink = undefined;
    }
    if (session?.failReason) {
      await this.removeSessionKey(localId);
    }
    return session;
  }

  private async failSession(
    localId: string,
    failReason: IBinanceDepositFailReason,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    if (this.memoryLink?.localId === localId) {
      this.memoryLink = undefined;
    }
    const session = await this.updateSession(localId, (s) =>
      s.failReason ? s : { ...s, destination: undefined, failReason },
    );
    await this.removeSessionKey(localId);
    return session;
  }

  private async getSession(
    localId: string,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    const session =
      await this.backgroundApi.simpleDb.binanceDeposit.getSession();
    return session?.localId === localId ? session : undefined;
  }

  private updateSession(
    localId: string,
    updater: (
      session: IBinanceDepositLocalSession,
    ) => IBinanceDepositLocalSession,
  ) {
    return this.backgroundApi.simpleDb.binanceDeposit.updateSession(
      localId,
      updater,
    );
  }

  private toSnapshot(
    session: IBinanceDepositLocalSession | undefined,
  ): IBinanceDepositSnapshot {
    if (!session) {
      throw this.buildError(EBinanceDepositLocalErrorCode.InvalidState);
    }
    const phase = getBinanceDepositPhase(session, this.bindPending);
    return {
      localId: session.localId,
      phase,
      status: session.status,
      networkId: session.networkId,
      cryptoCurrency: session.cryptoCurrency,
      destination: phase === 'authorized' ? session.destination : undefined,
      failReason: session.failReason,
    };
  }

  // Every deposit call goes through here. The body carries the session key
  // or the return nonce, so neither the body nor a caught error is logged or
  // put into an error message.
  private async request(
    path: string,
    body: Record<string, string>,
    timeout?: number,
  ): Promise<IRequestResult> {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      // Keeps the interceptor from turning a business code into a toast.
      const config: { autoHandleError: boolean; timeout?: number } = {
        autoHandleError: false,
      };
      if (timeout) {
        config.timeout = timeout;
      }
      const resp = await client.post<unknown>(
        `${BINANCE_DEPOSIT_API_PREFIX}${path}`,
        body,
        config,
      );
      const envelope = resp.data;
      if (!isRecord(envelope) || typeof envelope.code !== 'number') {
        return { ok: false };
      }
      return envelope.code === 0
        ? { ok: true, data: envelope.data }
        : { ok: false, code: envelope.code };
    } catch {
      return { ok: false };
    }
  }

  // Fixed messages only; the UI shows its own copy by `code`.
  private buildError(code: number | undefined) {
    return new OneKeyLocalError({
      code,
      message: 'Binance deposit request failed',
      autoToast: false,
    });
  }

  private async storeSessionKey(
    localId: string,
    sessionKey: string,
  ): Promise<boolean> {
    try {
      const storageKey = `${SESSION_KEY_STORAGE_PREFIX}${localId}`;
      await secureStorageInstance.setSecureItem(storageKey, sessionKey);
      // setSecureItem is skipped silently in Travel Mode.
      return (
        (await secureStorageInstance.getSecureItem(storageKey)) === sessionKey
      );
    } catch {
      // Not logged: a native storage error may quote what it was given.
      return false;
    }
  }

  private async readSessionKey(localId: string): Promise<string | undefined> {
    try {
      const value = await secureStorageInstance.getSecureItem(
        `${SESSION_KEY_STORAGE_PREFIX}${localId}`,
      );
      return typeof value === 'string' &&
        BINANCE_DEPOSIT_TOKEN_REGEX.test(value)
        ? value
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async removeSessionKey(localId: string) {
    try {
      await secureStorageInstance.removeSecureItem(
        `${SESSION_KEY_STORAGE_PREFIX}${localId}`,
      );
    } catch {
      // Nothing else to do; the key is unusable without its session.
    }
  }
}

export default ServiceBinanceDeposit;
