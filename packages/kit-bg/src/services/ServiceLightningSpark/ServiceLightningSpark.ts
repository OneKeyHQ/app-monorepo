import { getSparkNetworkFromImpl } from '@onekeyhq/core/src/chains/spark/utils';
import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
import { toSparkSerializable } from './sparkSerializeUtils';

import type { ISparkSerializable } from './sparkSerializeUtils';
import type { KeyringHd as KeyringHdSpark } from '../../vaults/impls/spark/KeyringHd';
import type {
  BreezSdk,
  ListPaymentsRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  SdkEvent,
} from '@breeztech/breez-sdk-spark';

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
const SPARK_PAYMENT_EVENTS = new Set<SdkEvent['type']>([
  'paymentSucceeded',
  'paymentPending',
  'paymentFailed',
]);

type ISparkRecentEvent = {
  walletId: string;
  receivedAt: number;
  event: ISparkSerializable<SdkEvent>;
};

// Breez keeps one wallet's state per storage directory, so the network is part
// of the name to keep wallets of different networks apart.
function getSparkStorageDir({
  network,
  walletId,
}: {
  network: ILightningSparkNetwork;
  walletId: string;
}) {
  return `onekey-breez-${network}-${walletId}`;
}

// Breez partner key, injected at build time (development/envExposedToClient.js).
// It identifies OneKey to Breez services and ships inside every client build,
// so it must not be treated as a secret.
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
  }

  private sdk: BreezSdk | undefined;

  private connectedWalletId: string | undefined;

  private connectedNetwork: ILightningSparkNetwork | undefined;

  // The connect in flight, shared by concurrent ensureConnected calls.
  private connecting: Promise<unknown> | undefined;

  // Bumped by every connect and disconnect; a connect that finishes under an
  // older generation was superseded and must not become the active SDK.
  private connectGeneration = 0;

  private releaseRuntimeLock: (() => void) | undefined;

  private recentEvents: ISparkRecentEvent[] = [];

  // Spark screens that keep the SDK connected, by holder id; the last one
  // set is the account a silent connect uses.
  private sessionHolders = new Map<
    string,
    { accountId: string; networkId: string }
  >();

  private idleDisconnectTimer: ReturnType<typeof setTimeout> | undefined;

  private paymentRefreshTimers: ReturnType<typeof setTimeout>[] = [];

  private getConnectedSdk(): { sdk: BreezSdk; walletId: string } {
    if (!this.sdk || !this.connectedWalletId) {
      throw new OneKeyLocalError('Lightning wallet is not connected');
    }
    return { sdk: this.sdk, walletId: this.connectedWalletId };
  }

  /**
   * `privateEnabledDefault: false` covers new wallets; a wallet that was
   * connected with the Breez default before is switched back here.
   */
  private async ensureSparkPublicMode(sdk: BreezSdk) {
    const settings = await sdk.getUserSettings();
    if (settings.sparkPrivateModeEnabled) {
      await sdk.updateUserSettings({ sparkPrivateModeEnabled: false });
    }
  }

  private onSdkEvent(walletId: string, event: SdkEvent) {
    this.recentEvents = [
      { walletId, receivedAt: Date.now(), event: toSparkSerializable(event) },
      ...this.recentEvents,
    ].slice(0, SPARK_RECENT_EVENTS_LIMIT);
    if (SPARK_PAYMENT_EVENTS.has(event.type)) {
      this.schedulePaymentRefresh();
    }
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
  }: {
    holderId: string;
    accountId: string;
    networkId: string;
  }) {
    // Re-adding moves the holder last, so it decides which account connects.
    this.sessionHolders.delete(holderId);
    this.sessionHolders.set(holderId, { accountId, networkId });
    this.cancelIdleDisconnect();
    await this.connectHeldSession();
  }

  @backgroundMethod()
  async releaseSession({ holderId }: { holderId: string }) {
    this.sessionHolders.delete(holderId);
    if (this.sessionHolders.size > 0) {
      return;
    }
    this.cancelIdleDisconnect();
    this.idleDisconnectTimer = setTimeout(() => {
      this.idleDisconnectTimer = undefined;
      if (this.sessionHolders.size === 0) {
        void this.disconnect();
      }
    }, SPARK_IDLE_DISCONNECT_MS);
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
    const sdk = await this.ensureConnected({ accountId, networkId });
    await sdk.syncWallet({});
    this.schedulePaymentRefresh();
  }

  private cancelIdleDisconnect() {
    clearTimeout(this.idleDisconnectTimer);
    this.idleDisconnectTimer = undefined;
  }

  private async connectHeldSession() {
    const held = [...this.sessionHolders.values()].at(-1);
    // Native and the extension cannot load the SDK yet.
    if (!held || platformEnv.isNative || platformEnv.isExtension) {
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
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        reason: EReasonForNeedPassword.Default,
      });
    const vault = await vaultFactory.getVault({ accountId, networkId });
    const childMnemonic = await (
      vault.keyring as KeyringHdSpark
    ).getChildMnemonicForConnect({ password });
    return this.connectWithChildMnemonic({
      walletId,
      network,
      apiKey,
      childMnemonic,
    });
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
  }): Promise<BreezSdk> {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const network = getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId }),
    );
    const isConnected = () =>
      this.connectedWalletId === walletId && this.connectedNetwork === network;
    if (this.connecting) {
      await this.connecting.catch(() => undefined);
    }
    if (!isConnected()) {
      this.connecting = this.connectAccount({ accountId, networkId });
      try {
        await this.connecting;
      } finally {
        this.connecting = undefined;
      }
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
    const sdk = await this.ensureConnected({ accountId, networkId });
    const amountSats = Number(amount);
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
    const sdk = await this.ensureConnected({ accountId, networkId });
    const prepared = await this.prepareInvoicePayment({ sdk, encodedTx });
    return { feeSats: String(getPreparedFeeSats(prepared)) };
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
    const sdk = await this.ensureConnected({ accountId, networkId });
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
    });
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
      }
    }
    return { paymentId: payment.id };
  }

  // The SDK parses payment requests from user input only here. The invoice
  // was decoded by the OneKey lightning service and passes the format check,
  // so the SDK parser has nothing to look up over the network.
  private async prepareInvoicePayment({
    sdk,
    encodedTx,
  }: {
    sdk: BreezSdk;
    encodedTx: IEncodedTxLightningSpark;
  }): Promise<PrepareSendPaymentResponse> {
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
    walletId,
    network,
    apiKey,
    childMnemonic,
  }: {
    walletId: string;
    network: ILightningSparkNetwork;
    apiKey: string;
    childMnemonic: string;
  }) {
    await this.disconnect();
    this.connectGeneration += 1;
    const generation = this.connectGeneration;
    const storageDir = getSparkStorageDir({ network, walletId });

    const releaseLock = await acquireSparkRuntimeLock(storageDir);
    if (!releaseLock) {
      throw new OneKeyLocalError(
        'This Lightning wallet is already connected in another tab',
      );
    }

    const startedAt = Date.now();
    let initMs = 0;
    let connectPromise: Promise<BreezSdk> | undefined;
    let sdk: BreezSdk;
    try {
      const breez = await loadBreezSdk();
      initMs = Date.now() - startedAt;
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
      if (generation !== this.connectGeneration) {
        throw new OneKeyLocalError('Lightning connect was superseded');
      }
      await sdk.addEventListener({
        onEvent: (event) => this.onSdkEvent(walletId, event),
      });
      await this.ensureSparkPublicMode(sdk);
    } catch (error) {
      // A connect that timed out or was superseded may still resolve; keep
      // the lock until it settles so no other tab opens the same storage.
      void (connectPromise ?? Promise.reject(error))
        .then((lateSdk) => lateSdk.disconnect())
        .catch(() => undefined)
        .finally(releaseLock);
      throw error;
    }
    this.sdk = sdk;
    this.connectedWalletId = walletId;
    this.connectedNetwork = network;
    this.releaseRuntimeLock = releaseLock;
    const connectMs = Date.now() - startedAt - initMs;

    const info = await sdk.getInfo({});
    return {
      walletId,
      identityPubkey: info.identityPubkey,
      balanceSats: info.balanceSats,
      initMs,
      connectMs,
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
      paymentMethod: ReceivePaymentMethod;
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
      Pick<ListPaymentsRequest, 'limit' | 'offset'>,
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

  @backgroundMethod()
  async disconnect() {
    this.cancelIdleDisconnect();
    this.connectGeneration += 1;
    const { sdk, releaseRuntimeLock } = this;
    this.sdk = undefined;
    this.connectedWalletId = undefined;
    this.connectedNetwork = undefined;
    this.releaseRuntimeLock = undefined;
    try {
      await sdk?.disconnect();
    } finally {
      releaseRuntimeLock?.();
    }
  }
}

export default ServiceLightningSpark;
