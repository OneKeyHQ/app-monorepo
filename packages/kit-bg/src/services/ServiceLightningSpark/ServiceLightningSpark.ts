import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { getSparkNetworkFromImpl } from '@onekeyhq/core/src/chains/spark/utils';
import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret/lightningSpark';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  InvalidLightningPaymentRequest,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { addBeforeAppRestartHandler } from '@onekeyhq/shared/src/modules3rdParty/appRestart/beforeAppRestart';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ICreateInvoiceResponse,
  IEncodedTxLightningSpark,
  IInvoiceConfig,
} from '@onekeyhq/shared/types/lightning';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { vaultFactory } from '../../vaults/factory';
import {
  checkPreparedFeeApproved,
  checkPreparedInvoicePayment,
  findSettledInvoicePaymentProblem,
  getPrepareAmountSats,
  getPreparedFeeSats,
  isSparkPayableInvoice,
} from '../../vaults/impls/spark/sdkSpark/invoicePayment';
import ServiceBase from '../ServiceBase';

import { loadBreezSdk } from './sdk/breezSdk';
import { dispatchOffscreenSdkEvent } from './sdk/breezSdkOffscreenClient';
import { removeSparkStorage } from './sdk/sparkStorage';
import { toSparkSerializable } from './sparkSerializeUtils';

import type {
  ISparkListPaymentsRequest,
  ISparkPayment,
  ISparkPreparedPayment,
  ISparkReceivePaymentMethod,
  ISparkSdk,
  ISparkSdkEvent,
} from './sdk/types';
import type { ISparkSerializable } from './sparkSerializeUtils';
import type { KeyringHd as KeyringHdSpark } from '../../vaults/impls/spark/KeyringHd';

// The wasm build cannot cancel a pending connect, so a connect that misses
// this deadline is treated as failed and disconnected if it resolves later.
const SPARK_CONNECT_TIMEOUT_MS = 30_000;
const SPARK_RECENT_EVENTS_LIMIT = 50;
// After the last Spark screen closes the SDK stays connected this long, so
// coming straight back does not connect again.
const SPARK_IDLE_DISCONNECT_MS = 60_000;
// A payment refreshes balances and history twice: once the OneKey server's
// 5 s read cache has expired, and again after the explorer the server reads
// has indexed it (7-17 s after a claim in the 11-03 mainnet tests).
const SPARK_PAYMENT_REFRESH_DELAYS_MS = [6000, 20_000];
// How long a send waits for its Lightning payment to finish. A payment still
// in flight after that is returned as pending, and history shows the result.
const SPARK_SEND_COMPLETION_TIMEOUT_SECS = 30;
const SPARK_PAYMENT_EVENTS = new Set<ISparkSdkEvent['type']>([
  'paymentSucceeded',
  'paymentPending',
  'paymentFailed',
]);

// A connect from before it reads the wallet's credential until it publishes
// its SDK or gives up. It owns the generation that the teardown of the
// previous SDK, which it starts itself, moves on by one. Removing its wallet
// cancels it.
type ISparkConnectIntent = {
  walletId: string;
  generation: number;
  cancelled: boolean;
  // Set once it acquires the SDK, the only step that touches the storage.
  acquiring: boolean;
  settled: Promise<void>;
};

type ISparkRecentEvent = {
  walletId: string;
  receivedAt: number;
  event: ISparkSerializable<ISparkSdkEvent>;
};

// Every Spark storage directory starts with this, so App Reset can find them.
const SPARK_STORAGE_DIR_PREFIX = 'onekey-breez-';
const SPARK_NETWORKS: ILightningSparkNetwork[] = ['mainnet', 'regtest'];

// Breez keeps one wallet's state per storage directory, so the network is part
// of the name to keep wallets of different networks apart.
function getSparkStorageDir({
  network,
  walletId,
}: {
  network: ILightningSparkNetwork;
  walletId: string;
}) {
  return `${SPARK_STORAGE_DIR_PREFIX}${network}-${walletId}`;
}

// Breez partner key, injected at build time (development/envExposedToClient.js).
// It identifies OneKey to Breez services and ships inside every client build,
// so it must not be treated as a secret.
// The idempotency key of a send's attempt: the key the send was built with,
// then, after each failed payment, a UUID derived from it. Breez stores a
// payment under the key it was sent with, so the attempts of a send are
// found in the wallet's storage by every runtime, after a restart too.
function getSendAttemptKey(sendKey: string, attempt: number): string {
  if (attempt === 0) {
    return sendKey;
  }
  const hex = bytesToHex(sha256(utf8ToBytes(`${sendKey}:${attempt}`)));
  // The layout of a version 4 UUID: version digit 4, variant digit 8 to b.
  const variant = '89ab'[parseInt(hex[16], 16) % 4];
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

// The payment the wallet's storage holds under this id. A lookup that fails
// counts as none: sending with the key stays safe, since Breez checks its
// storage for the key again and sends under it as the transfer id.
async function getStoredPayment(
  sdk: ISparkSdk,
  paymentId: string,
): Promise<ISparkPayment | undefined> {
  try {
    const { payment } = await sdk.getPayment({ paymentId });
    return payment;
  } catch {
    return undefined;
  }
}

function toInvoicePaymentResult({
  payment,
  encodedTx,
}: {
  payment: ISparkPayment;
  encodedTx: IEncodedTxLightningSpark;
}): { paymentId: string } {
  if (payment.status === 'failed') {
    throw new OneKeyLocalError('Lightning payment failed');
  }
  if (payment.status === 'completed') {
    const problem = findSettledInvoicePaymentProblem({ payment, encodedTx });
    if (problem) {
      defaultLogger.lightning.spark.paymentNotVerified({
        paymentId: payment.id,
        reason: problem,
      });
      // Not a sent invoice: the result stays unknown. The attempt stays in
      // the wallet's storage, so confirming again reads it instead of paying
      // a second time.
      throw new OneKeyLocalError(
        'The Lightning payment could not be verified. Check the history before paying again.',
      );
    }
  }
  return { paymentId: payment.id };
}

function getBreezApiKey(): string {
  const apiKey = process.env.BREEZ_API_KEY;
  if (!apiKey) {
    throw new OneKeyLocalError('Breez API key is not configured');
  }
  return apiKey;
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new OneKeyLocalError(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Holds a Web Locks API lock while a wallet is connected, so a second tab
 * (each tab runs its own kit-bg) cannot open the same Breez storage.
 * Resolves `undefined` when another runtime already holds the lock.
 */
function acquireSparkRuntimeLock(
  name: string,
): Promise<(() => void) | undefined> {
  const locks = globalThis.navigator?.locks;
  if (!locks) {
    return Promise.resolve(() => {});
  }
  return new Promise((resolve) => {
    void locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(undefined);
        return undefined;
      }
      return new Promise<void>((release) => {
        resolve(() => release());
      });
    });
  });
}

@backgroundClass()
class ServiceLightningSpark extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    appEventBus.on(EAppEventBusNames.LockApp, () => {
      void this.disconnect();
    });
    appEventBus.on(EAppEventBusNames.UnlockApp, () => {
      void this.connectHeldSession();
    });
    // Extension: a popup, side panel or tab closed without its screens'
    // cleanup.
    appEventBus.on(EAppEventBusNames.ExtensionUiPageClosed, ({ pageId }) => {
      this.releasePageSessions(pageId);
    });
    // Called on iOS only, where a restart keeps the process.
    addBeforeAppRestartHandler(() => this.disconnectBeforeAppRestart());
  }

  private sdk: ISparkSdk | undefined;

  private connectedWalletId: string | undefined;

  private connectedNetwork: ILightningSparkNetwork | undefined;

  // The connect in flight, shared by concurrent ensureConnected calls.
  private connecting: Promise<unknown> | undefined;

  // Bumped by every connect and disconnect; a connect that finishes under an
  // older generation was superseded and must not become the active SDK.
  private connectGeneration = 0;

  private releaseRuntimeLock: (() => void) | undefined;

  // SDK connects still in flight. Each ends as the active SDK or disconnects
  // its SDK, and a restart waits for that.
  private pendingSdkConnects = new Set<Promise<void>>();

  // SDKs still shutting down. A disconnect clears this.sdk before its SDK
  // is gone, so a restart or a storage removal waits for these as well.
  private closingSdks = new Set<Promise<void>>();

  private connectIntents = new Set<ISparkConnectIntent>();

  // Set when the app is about to restart; no SDK connect starts after that.
  private closedForRestart = false;

  private recentEvents: ISparkRecentEvent[] = [];

  // Spark screens that keep the SDK connected, by holder id; the last one
  // set is the account a silent connect uses. In the extension a hold also
  // names the page that shows the screen.
  private sessionHolders = new Map<
    string,
    { accountId: string; networkId: string; pageId?: string }
  >();

  private idleDisconnectTimer: ReturnType<typeof setTimeout> | undefined;

  // Explicit SDK calls in flight: the account each waits to connect, then the
  // SDK it got. The idle expiry leaves an SDK connected until the calls that
  // use it, or wait for its wallet, settle.
  private sdkCalls = new Set<{
    accountId: string;
    networkId: string;
    sdk?: ISparkSdk;
  }>();

  // The idle expiry passed while SDK calls were in flight; it starts again
  // once the last of them settles.
  private isIdleExpiryDeferred = false;

  // A held screen's connect waited for SDK calls in flight to settle.
  private isHeldConnectDeferred = false;

  private paymentRefreshTimers: ReturnType<typeof setTimeout>[] = [];

  private getConnectedSdk(): { sdk: ISparkSdk; walletId: string } {
    if (!this.sdk || !this.connectedWalletId) {
      throw new OneKeyLocalError('Lightning wallet is not connected');
    }
    return { sdk: this.sdk, walletId: this.connectedWalletId };
  }

  /**
   * `privateEnabledDefault: false` covers new wallets; a wallet that was
   * connected with the Breez default before is switched back here.
   */
  private async ensureSparkPublicMode(sdk: ISparkSdk) {
    const settings = await sdk.getUserSettings();
    if (settings.sparkPrivateModeEnabled) {
      await sdk.updateUserSettings({ sparkPrivateModeEnabled: false });
    }
  }

  private onSdkEvent(walletId: string, event: ISparkSdkEvent) {
    this.recentEvents = [
      { walletId, receivedAt: Date.now(), event: toSparkSerializable(event) },
      ...this.recentEvents,
    ].slice(0, SPARK_RECENT_EVENTS_LIMIT);
    if (SPARK_PAYMENT_EVENTS.has(event.type)) {
      this.schedulePaymentRefresh();
    }
  }

  /**
   * Extension only: the offscreen document runs the SDK and passes its
   * events on here, to the listener of the session they belong to.
   */
  @backgroundMethod()
  async receiveOffscreenSdkEvent(payload: {
    sessionId: string;
    event: unknown;
  }) {
    dispatchOffscreenSdkEvent(payload);
  }

  // One set of refreshes per burst of payment events. History lists, token
  // details included, reload on HistoryTxStatusChanged.
  private schedulePaymentRefresh() {
    this.paymentRefreshTimers.forEach((timer) => clearTimeout(timer));
    this.paymentRefreshTimers = SPARK_PAYMENT_REFRESH_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
      }, delay),
    );
  }

  /**
   * Keeps the SDK connected while a Spark screen is open: the single-network
   * home, a Spark token's details or the invoice page. It connects only when
   * the password is cached and never asks for it; receive and send ask when
   * they need the SDK.
   */
  @backgroundMethod()
  async holdSession({
    holderId,
    accountId,
    networkId,
    pageId,
  }: {
    holderId: string;
    accountId: string;
    networkId: string;
    pageId?: string;
  }) {
    // Re-adding moves the holder last, so it decides which account connects.
    this.sessionHolders.delete(holderId);
    this.sessionHolders.set(holderId, { accountId, networkId, pageId });
    this.cancelIdleDisconnect();
    await this.connectHeldSession();
  }

  @backgroundMethod()
  async releaseSession({ holderId }: { holderId: string }) {
    this.sessionHolders.delete(holderId);
    if (this.sessionHolders.size === 0) {
      this.scheduleIdleDisconnect();
    } else {
      // A remaining screen may show another wallet than the connected one.
      await this.connectHeldSession();
    }
  }

  private releasePageSessions(pageId: string) {
    let released = false;
    for (const [holderId, holder] of this.sessionHolders) {
      if (holder.pageId === pageId) {
        this.sessionHolders.delete(holderId);
        released = true;
      }
    }
    if (!released) {
      return;
    }
    if (this.sessionHolders.size === 0) {
      if (this.sdk) {
        this.scheduleIdleDisconnect();
      }
    } else {
      void this.connectHeldSession();
    }
  }

  private scheduleIdleDisconnect() {
    this.cancelIdleDisconnect();
    this.idleDisconnectTimer = setTimeout(() => {
      this.idleDisconnectTimer = undefined;
      void this.disconnectIdleSdk();
    }, SPARK_IDLE_DISCONNECT_MS);
  }

  // A connect in flight settles first and is not cancelled: one that
  // succeeds has replaced the idle SDK, and one that fails, such as a
  // cancelled password prompt, leaves the idle SDK to end here.
  private async disconnectIdleSdk() {
    const idleSdk = this.sdk;
    while (this.connecting) {
      await this.connecting.catch(() => undefined);
    }
    if (
      !idleSdk ||
      this.sdk !== idleSdk ||
      this.sessionHolders.size > 0 ||
      this.idleDisconnectTimer
    ) {
      return;
    }
    if (this.hasCallsFor(idleSdk)) {
      this.isIdleExpiryDeferred = true;
      return;
    }
    await this.disconnect();
  }

  // A call waiting for a connect of the SDK's wallet gets this SDK too. A
  // call still on an SDK that was replaced does not count.
  private hasCallsFor(sdk: ISparkSdk | undefined): boolean {
    return [...this.sdkCalls].some((call) => {
      if (call.sdk) {
        return call.sdk === sdk;
      }
      return (
        sdk === this.sdk &&
        this.connectedWalletId ===
          accountUtils.getWalletIdFromAccountId({
            accountId: call.accountId,
          }) &&
        this.connectedNetwork ===
          getSparkNetworkFromImpl(
            networkUtils.getNetworkImpl({ networkId: call.networkId }),
          )
      );
    });
  }

  // Runs an explicit SDK call. It counts from before its connect until its
  // work ends, so an idle expiry in between waits for it.
  private async withConnectedSdk<T>(
    params: { accountId: string; networkId: string },
    run: (sdk: ISparkSdk) => Promise<T>,
  ): Promise<T> {
    const call: { accountId: string; networkId: string; sdk?: ISparkSdk } = {
      ...params,
    };
    this.sdkCalls.add(call);
    try {
      call.sdk = await this.ensureConnected(params);
      return await run(call.sdk);
    } finally {
      this.sdkCalls.delete(call);
      if (this.isHeldConnectDeferred && !this.hasCallsFor(this.sdk)) {
        this.isHeldConnectDeferred = false;
        void this.connectHeldSession();
      }
      if (this.isIdleExpiryDeferred && !this.hasCallsFor(this.sdk)) {
        this.isIdleExpiryDeferred = false;
        if (this.sessionHolders.size === 0 && this.sdk) {
          this.scheduleIdleDisconnect();
        }
      }
    }
  }

  /**
   * Claims sats paid to the account while its wallet was offline: connects,
   * asking for the password unless it is cached, then syncs, which claims
   * pending transfers.
   */
  @backgroundMethod()
  async claimPendingReceive({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    await this.withConnectedSdk({ accountId, networkId }, (sdk) =>
      sdk.syncWallet({}),
    );
    this.schedulePaymentRefresh();
  }

  private cancelIdleDisconnect() {
    clearTimeout(this.idleDisconnectTimer);
    this.idleDisconnectTimer = undefined;
    this.isIdleExpiryDeferred = false;
  }

  /**
   * Extension only: the offscreen document that ran the SDK lost its port
   * and reloads, which ended the session. Starts over as after a disconnect and
   * connects again while a Spark screen is open; that connect's sync claims
   * what arrived meanwhile.
   */
  private async reconnectAfterSessionLost() {
    defaultLogger.lightning.spark.sessionLost();
    await this.disconnect();
    await this.connectHeldSession();
  }

  private async connectHeldSession() {
    const held = [...this.sessionHolders.values()].at(-1);
    if (!held) {
      return;
    }
    // A connect in flight goes first, so the cache is read right before this
    // connect and a passive connect never asks for the password.
    while (this.connecting) {
      await this.connecting.catch(() => undefined);
    }
    // Calls in flight keep their SDK; this connect follows once they settle.
    if (this.hasCallsFor(this.sdk)) {
      this.isHeldConnectDeferred = true;
      return;
    }
    // Reading the cache this way does not extend its lifetime.
    if (!(await this.backgroundApi.servicePassword.hasCachedPassword())) {
      return;
    }
    try {
      await this.ensureConnected(held);
    } catch (error) {
      // Another tab holding the wallet or a failed connect leaves the screen
      // on server data; receive and send connect again when they need to.
      defaultLogger.lightning.spark.autoConnectFailed({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    // The last screen may have closed while the wallet connected; the
    // connect cleared the timer that its release set.
    if (this.sessionHolders.size === 0 && this.sdk) {
      this.scheduleIdleDisconnect();
    }
  }

  /**
   * Connects the Breez SDK for a Spark account. The BIP-85 child mnemonic is
   * derived here from the wallet's HD credential and only handed to the SDK.
   */
  @backgroundMethod()
  async connectAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    if (
      !accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isBotWallet({ walletId })
    ) {
      throw new OneKeyLocalError('Spark supports software wallets only');
    }
    const network = getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId }),
    );
    // Checked before the password prompt so a build without the key fails
    // without asking for the password.
    const apiKey = getBreezApiKey();
    // A lock, a restart, another connect or the removal of the wallet that
    // lands while the password is checked or the key derived cancels this.
    let settle: () => void = () => undefined;
    const intent: ISparkConnectIntent = {
      walletId,
      generation: this.connectGeneration,
      cancelled: false,
      acquiring: false,
      settled: new Promise<void>((resolve) => {
        settle = resolve;
      }),
    };
    this.connectIntents.add(intent);
    try {
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
          walletId,
          reason: EReasonForNeedPassword.Default,
        });
      const vault = await vaultFactory.getVault({ accountId, networkId });
      const childMnemonic = await (
        vault.keyring as KeyringHdSpark
      ).getChildMnemonicForConnect({ password });
      if (intent.generation !== this.connectGeneration || intent.cancelled) {
        throw new OneKeyLocalError('Lightning connect was superseded');
      }
      intent.acquiring = true;
      return await this.connectWithChildMnemonic({
        intent,
        network,
        apiKey,
        childMnemonic,
      });
    } finally {
      this.connectIntents.delete(intent);
      settle();
    }
  }

  /**
   * Returns the SDK of the account's wallet. It connects, asking for the
   * password unless it is cached, only when that wallet is not connected yet.
   */
  private async ensureConnected({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<ISparkSdk> {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const network = getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId }),
    );
    const isConnected = () =>
      this.connectedWalletId === walletId && this.connectedNetwork === network;
    // One connect at a time: a caller that waited may find the next connect
    // already started by another caller, and waits for that one too.
    while (this.connecting) {
      await this.connecting.catch(() => undefined);
    }
    if (!isConnected()) {
      const connecting = this.connectAccount({ accountId, networkId });
      this.connecting = connecting;
      try {
        await connecting;
      } finally {
        if (this.connecting === connecting) {
          this.connecting = undefined;
        }
      }
    }
    // Hand out this wallet's SDK only: another wallet's connect or a lock can
    // replace it before this caller resumes.
    if (!isConnected()) {
      throw new OneKeyLocalError('Lightning wallet changed while connecting');
    }
    return this.getConnectedSdk().sdk;
  }

  // Breez exposes no receive or send limits; 0 turns off the amount caps of
  // the Lightning forms, as a custodial config without limits does.
  async getInvoiceConfig(): Promise<IInvoiceConfig> {
    return { maxReceiveAmount: 0, maxSendAmount: 0 };
  }

  /**
   * Creates a BOLT11 invoice for the receive flow. Phase 1 receives only
   * through invoices, never through the Spark address.
   */
  async createInvoice({
    accountId,
    networkId,
    amount,
    description,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    description?: string;
  }): Promise<ICreateInvoiceResponse['data']> {
    return this.withConnectedSdk({ accountId, networkId }, (sdk) =>
      this.createInvoiceWithSdk({ sdk, amount, description }),
    );
  }

  private async createInvoiceWithSdk({
    sdk,
    amount,
    description,
  }: {
    sdk: ISparkSdk;
    amount: string;
    description?: string;
  }): Promise<ICreateInvoiceResponse['data']> {
    const amountSats = Number(amount);
    // The SDK takes whole sats; the receive form also accepts finer amounts.
    if (amountSats > 0 && !Number.isSafeInteger(amountSats)) {
      throw new OneKeyLocalError('Enter a whole number of sats');
    }
    const { paymentRequest } = await sdk.receivePayment({
      paymentMethod: {
        type: 'bolt11Invoice',
        description: description ?? '',
        // An empty or zero amount creates an invoice without an amount.
        amountSats: amountSats > 0 ? amountSats : undefined,
      },
    });
    const invoice = await sdk.parse(paymentRequest);
    if (invoice.type !== 'bolt11Invoice') {
      throw new OneKeyLocalError('Unexpected Lightning invoice');
    }
    return {
      payment_request: paymentRequest,
      payment_hash: invoice.paymentHash,
      expires_at: new Date(
        (invoice.timestamp + invoice.expiry) * 1000,
      ).toISOString(),
    };
  }

  /**
   * Tells the invoice page whether its invoice was paid. It only reads a
   * wallet that is already connected and never asks for the password.
   */
  @backgroundMethod()
  async fetchInvoicePaymentStatus({
    accountId,
    networkId,
    paymentHash,
  }: {
    accountId: string;
    networkId: string;
    paymentHash: string;
  }): Promise<{ isPaid: boolean }> {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const network = getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId }),
    );
    const { sdk } = this;
    if (
      !sdk ||
      this.connectedWalletId !== walletId ||
      this.connectedNetwork !== network
    ) {
      return { isPaid: false };
    }
    const { payments } = await sdk.listPayments({
      typeFilter: ['receive'],
      limit: 20,
    });
    // A payer on Spark may settle the invoice as a Spark transfer, which
    // carries the same HTLC payment hash as a Lightning payment.
    const isPaid = payments.some((payment) => {
      const { details } = payment;
      const htlc =
        details?.type === 'lightning' || details?.type === 'spark'
          ? details.htlcDetails
          : undefined;
      return (
        payment.status === 'completed' && htlc?.paymentHash === paymentHash
      );
    });
    return { isPaid };
  }

  /**
   * Quotes the fee of paying a BOLT11 invoice, for the confirm page. It
   * connects, asking for the password unless it is cached.
   */
  async quoteInvoicePayment({
    accountId,
    networkId,
    encodedTx,
  }: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTxLightningSpark;
  }): Promise<{ feeSats: string }> {
    return this.withConnectedSdk({ accountId, networkId }, async (sdk) => {
      const prepared = await this.prepareInvoicePayment({ sdk, encodedTx });
      return { feeSats: String(getPreparedFeeSats(prepared)) };
    });
  }

  /**
   * Pays a BOLT11 invoice the user approved on the confirm page. The SDK
   * prepares it again, and the payment stops when that preparation differs
   * from the confirmed invoice or quotes a fee above the approved one.
   */
  async payInvoice({
    accountId,
    networkId,
    encodedTx,
  }: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTxLightningSpark;
  }): Promise<{ paymentId: string }> {
    return this.withConnectedSdk({ accountId, networkId }, (sdk) =>
      this.payInvoiceWithSdk({ sdk, encodedTx }),
    );
  }

  private async payInvoiceWithSdk({
    sdk,
    encodedTx,
  }: {
    sdk: ISparkSdk;
    encodedTx: IEncodedTxLightningSpark;
  }): Promise<{ paymentId: string }> {
    let idempotencyKey: string | undefined;
    if (encodedTx.idempotencyKey) {
      // An earlier attempt of this send that is in flight or paid is the
      // result, read before a new quote could stop it as a fee change. A
      // failed one moves on to the next attempt's key.
      for (let attempt = 0; !idempotencyKey; attempt += 1) {
        const key = getSendAttemptKey(encodedTx.idempotencyKey, attempt);
        const earlier = await getStoredPayment(sdk, key);
        if (!earlier) {
          idempotencyKey = key;
        } else if (earlier.status !== 'failed') {
          return toInvoicePaymentResult({ payment: earlier, encodedTx });
        }
      }
    }
    const prepared = await this.prepareInvoicePayment({ sdk, encodedTx });
    checkPreparedFeeApproved({ prepared, encodedTx });
    const { payment } = await sdk.sendPayment({
      prepareResponse: prepared,
      options: {
        type: 'bolt11Invoice',
        // Always over Lightning, the route whose fee the confirm page showed.
        preferSpark: false,
        completionTimeoutSecs: SPARK_SEND_COMPLETION_TIMEOUT_SECS,
      },
      idempotencyKey,
    });
    return toInvoicePaymentResult({ payment, encodedTx });
  }

  // The SDK parses payment requests from user input only here. The invoice
  // was decoded by the OneKey lightning service and passes the format check,
  // so the SDK parser has nothing to look up over the network.
  private async prepareInvoicePayment({
    sdk,
    encodedTx,
  }: {
    sdk: ISparkSdk;
    encodedTx: IEncodedTxLightningSpark;
  }): Promise<ISparkPreparedPayment> {
    if (!isSparkPayableInvoice(encodedTx.invoice)) {
      throw new InvalidLightningPaymentRequest();
    }
    const amount = getPrepareAmountSats(encodedTx);
    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: encodedTx.invoice },
      ...(amount === undefined ? {} : { amount }),
    });
    checkPreparedInvoicePayment({ prepared, encodedTx });
    return prepared;
  }

  private async connectWithChildMnemonic({
    intent,
    network,
    apiKey,
    childMnemonic,
  }: {
    intent: ISparkConnectIntent;
    network: ILightningSparkNetwork;
    apiKey: string;
    childMnemonic: string;
  }) {
    const { walletId } = intent;
    await this.disconnect();
    // The disconnect above moved the generation on by one. A lock, a restart,
    // a wallet removal or another connect while the previous SDK shut down
    // moved it again, and this connect is stale.
    const generation = intent.generation + 1;
    const assertNotSuperseded = () => {
      if (generation !== this.connectGeneration || intent.cancelled) {
        throw new OneKeyLocalError('Lightning connect was superseded');
      }
    };
    assertNotSuperseded();
    const storageDir = getSparkStorageDir({ network, walletId });

    const releaseLock = await acquireSparkRuntimeLock(storageDir);
    if (!releaseLock) {
      throw new OneKeyLocalError(
        'This Lightning wallet is already connected in another tab',
      );
    }

    const startedAt = Date.now();
    let initMs = 0;
    let connectPromise: Promise<ISparkSdk> | undefined;
    let finishPendingConnect: () => void = () => undefined;
    let sdk: ISparkSdk;
    try {
      // Bounded too: a stalled first load (the wasm init) would hold every
      // later connect in the queue. The load itself goes on and the next
      // connect waits for it again, as a second wasm init would replace the
      // instance in use.
      const breez = await promiseWithTimeout(
        loadBreezSdk(),
        SPARK_CONNECT_TIMEOUT_MS,
        'Lightning connect timed out',
      );
      initMs = Date.now() - startedAt;
      if (this.closedForRestart) {
        throw new OneKeyLocalError('The app is restarting');
      }
      // Before the SDK creates the wallet's storage: a removed wallet must not
      // get it back.
      assertNotSuperseded();
      const pendingConnect = new Promise<void>((resolve) => {
        finishPendingConnect = resolve;
      }).finally(() => this.pendingSdkConnects.delete(pendingConnect));
      this.pendingSdkConnects.add(pendingConnect);
      connectPromise = breez.connect({
        config: {
          ...breez.defaultConfig(network),
          apiKey,
          // Spark balances and transfers are read by the OneKey server with
          // an unauthenticated client, like any other chain, so the wallet
          // must stay out of Spark private mode.
          privateEnabledDefault: false,
          // Phase 1 receives through invoices only, so no Lightning address
          // (Breez LNURL server) and no third-party input parsers.
          lnurlDomain: undefined,
          useDefaultExternalInputParsers: false,
          // No multi-device sync yet, so no Breez real-time sync server.
          realTimeSyncServerUrl: undefined,
        },
        seed: { type: 'mnemonic', mnemonic: childMnemonic },
        storageDir,
      });
      sdk = await promiseWithTimeout(
        connectPromise,
        SPARK_CONNECT_TIMEOUT_MS,
        'Lightning connect timed out',
      );
      assertNotSuperseded();
      sdk.onSessionLost?.(() => {
        if (generation === this.connectGeneration) {
          void this.reconnectAfterSessionLost();
        }
      });
      // Bounded too: a stalled setup would hold every later connect in the
      // queue. On a timeout the catch below disconnects this SDK.
      const setUpSdk = async () => {
        await sdk.addEventListener({
          onEvent: (event) => this.onSdkEvent(walletId, event),
        });
        await this.ensureSparkPublicMode(sdk);
      };
      await promiseWithTimeout(
        setUpSdk(),
        SPARK_CONNECT_TIMEOUT_MS,
        'Lightning connect timed out',
      );
      // A lock or a restart may have disconnected during the two calls above.
      assertNotSuperseded();
    } catch (error) {
      // A connect that timed out or was superseded may still resolve; keep
      // the lock until it settles so no other tab opens the same storage.
      void (connectPromise ?? Promise.reject(error))
        .then((lateSdk) => lateSdk.disconnect())
        .catch(() => undefined)
        .finally(() => {
          releaseLock();
          finishPendingConnect();
        });
      throw error;
    }
    this.sdk = sdk;
    this.connectedWalletId = walletId;
    this.connectedNetwork = network;
    this.releaseRuntimeLock = releaseLock;
    finishPendingConnect();
    // Returns once the SDK is ready: callers queued behind this connect must
    // not wait for a wallet read, which has no deadline.
    return {
      walletId,
      initMs,
      connectMs: Date.now() - startedAt - initMs,
    };
  }

  @backgroundMethodForDev()
  async devGetInfo(
    params: IBackgroundMethodWithDevOnlyPassword & { ensureSynced?: boolean },
  ) {
    const { sdk, walletId } = this.getConnectedSdk();
    const info = await sdk.getInfo({ ensureSynced: params.ensureSynced });
    return { walletId, ...toSparkSerializable(info) };
  }

  @backgroundMethodForDev()
  async devReceivePayment(
    params: IBackgroundMethodWithDevOnlyPassword & {
      paymentMethod: ISparkReceivePaymentMethod;
    },
  ) {
    const { sdk } = this.getConnectedSdk();
    const response = await sdk.receivePayment({
      paymentMethod: params.paymentMethod,
    });
    return toSparkSerializable(response);
  }

  @backgroundMethodForDev()
  async devListPayments(
    params: IBackgroundMethodWithDevOnlyPassword &
      Pick<ISparkListPaymentsRequest, 'limit' | 'offset'>,
  ) {
    const { sdk } = this.getConnectedSdk();
    const { payments } = await sdk.listPayments({
      limit: params.limit ?? 20,
      offset: params.offset,
    });
    return payments.map((payment) => toSparkSerializable(payment));
  }

  @backgroundMethodForDev()
  async devGetRecentEvents(_params: IBackgroundMethodWithDevOnlyPassword) {
    return this.recentEvents;
  }

  @backgroundMethodForDev()
  async devGetUserSettings(_params: IBackgroundMethodWithDevOnlyPassword) {
    const { sdk } = this.getConnectedSdk();
    return sdk.getUserSettings();
  }

  /**
   * The native SDK lives outside the JS runtime. When iOS rebuilds this
   * runtime in place, an SDK left connected keeps running with nothing able
   * to reach it. In tests such leftovers stalled the sync of later connects
   * and aborted the app when one emitted an event to its vanished listener.
   * So a restart disconnects the SDK first, waits for a connect in flight to
   * give up its SDK, and lets no connect start after that: the runtime is
   * gone right after.
   */
  private async disconnectBeforeAppRestart() {
    const startedAt = Date.now();
    this.closedForRestart = true;
    const pendingConnects = await this.disconnectAndSettle();
    defaultLogger.lightning.spark.disconnectedBeforeRestart({
      durationMs: Date.now() - startedAt,
      pendingConnects,
    });
  }

  // Cancels the connects of wallets whose storage is about to be deleted and
  // waits for them to end; one already connecting is in pendingSdkConnects
  // until its SDK is gone.
  private async cancelConnectIntents(
    matches: (intent: ISparkConnectIntent) => boolean,
  ) {
    const intents = [...this.connectIntents].filter(matches);
    intents.forEach((intent) => {
      intent.cancelled = true;
    });
    // One still at its password prompt or key derivation stops at its next
    // check without touching the storage, so only acquiring ones are awaited.
    await Promise.all(
      intents
        .filter((intent) => intent.acquiring)
        .map((intent) => intent.settled),
    );
  }

  /**
   * Disconnects and waits for a connect in flight to give up its SDK, so no
   * SDK keeps a Breez storage open. Returns how many connects were in flight.
   */
  private async disconnectAndSettle() {
    const pendingConnects = [...this.pendingSdkConnects];
    const closing = [...this.closingSdks];
    // Every shutdown ends first, this one's included. A failed one then fails
    // the caller, as its SDK may still hold the storage open.
    const results = await Promise.allSettled([
      this.disconnect(),
      ...closing,
      ...pendingConnects,
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) {
      throw failure.reason;
    }
    return pendingConnects.length;
  }

  /**
   * Deletes a removed wallet's Breez storage on every network: Breez keeps
   * the wallet's payment history on the device. An SDK of that wallet, or
   * one still connecting, holds the storage open and is disconnected first.
   */
  async removeWalletStorage({ walletId }: { walletId: string }) {
    await this.cancelConnectIntents((intent) => intent.walletId === walletId);
    if (
      this.connectedWalletId === walletId ||
      this.pendingSdkConnects.size > 0
    ) {
      await this.disconnectAndSettle();
    } else {
      // A lock or an idle expiry may still be closing this wallet's SDK.
      await Promise.all(this.closingSdks);
    }
    const storageDirs = new Set(
      SPARK_NETWORKS.map((network) =>
        getSparkStorageDir({ network, walletId }),
      ),
    );
    await removeSparkStorage((storageDir) => storageDirs.has(storageDir));
  }

  /** App Reset: deletes the Breez storage of every wallet. */
  async removeAllStorage() {
    await this.cancelConnectIntents(() => true);
    await this.disconnectAndSettle();
    await removeSparkStorage((storageDir) =>
      storageDir.startsWith(SPARK_STORAGE_DIR_PREFIX),
    );
  }

  @backgroundMethod()
  async disconnect() {
    this.cancelIdleDisconnect();
    this.connectGeneration += 1;
    const { sdk, releaseRuntimeLock } = this;
    this.sdk = undefined;
    this.connectedWalletId = undefined;
    this.connectedNetwork = undefined;
    this.releaseRuntimeLock = undefined;
    const teardown = (async () => {
      try {
        await sdk?.disconnect();
      } finally {
        releaseRuntimeLock?.();
      }
    })();
    this.closingSdks.add(teardown);
    try {
      await teardown;
    } finally {
      this.closingSdks.delete(teardown);
    }
  }
}

export default ServiceLightningSpark;
