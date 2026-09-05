import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WC_PAY_PROGRESS_CORRUPT_ERROR,
  WC_PAY_PROGRESS_UNREADABLE_ERROR,
  shouldRefuseWcPayWithoutDurableProgress,
} from '@onekeyhq/shared/src/walletConnect/payBroadcastUtils';
import {
  WALLET_CONNECT_PAY_EIP155_CHAIN_REFS,
  WALLET_CONNECT_PAY_SOLANA_CHAINS,
  WALLET_CONNECT_PAY_TRUSTED_HOST,
  validateWcPayLinkDomain,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAction,
  IWcPayConfirmResult,
  IWcPayOption,
  IWcPayOptionsResult,
  IWcPayPreBroadcastRecord,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import ServiceBase from '../ServiceBase';
import walletConnectClients from '../ServiceWalletConnect/walletConnectClient';

import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from './evmPayUtils';
import { getWcPayActionFingerprint } from './payFingerprintUtils';
import {
  extractWcPaySolanaTransaction,
  wcPaySolanaTxToEncodedTx,
} from './solPayUtils';

import type { IWcPaySolanaConsistencyResult } from './wcPaySolanaConsistency';
import type {
  IWcPayBroadcastMeta,
  IWcPayStoredProgress,
} from '../../dbs/simple/entity/SimpleDbEntityWalletConnectPay';

/**
 * Validate the whole action list before it reaches the executor. Actions run
 * sequentially and the leading ones may broadcast transactions, so a defect
 * in a later action (unknown chain/method, unparseable JSON params, wrong
 * param shape) must fail the flow here — before any signing starts — instead
 * of midway through, where the payment would be stranded partially completed.
 */
// Which CAIP-2 namespace each action method belongs to. Chain and method are
// each valid on their own terms, so without this pairing a mismatched action
// (a Solana chain carrying eth_sendTransaction, say) passes validation and
// only fails inside the executor — midway through a sequence whose earlier
// actions may already have broadcast, exactly the stranding this validator
// exists to prevent. An unknown method is absent here and still falls to the
// switch's default throw below.
const WC_PAY_METHOD_NAMESPACES: Partial<Record<EWcPayActionMethod, string>> = {
  [EWcPayActionMethod.EthSendTransaction]: 'eip155',
  [EWcPayActionMethod.EthSignTypedDataV4]: 'eip155',
  [EWcPayActionMethod.PersonalSign]: 'eip155',
  [EWcPayActionMethod.SolanaSignTransaction]: 'solana',
};

export async function validateWcPayActions(
  actions: IWcPayAction[],
): Promise<void> {
  for (const action of actions) {
    const { chainId, method, params } = action.walletRpc;
    const targetNetworkId = wcPayChainIdToNetworkId(chainId);
    if (!targetNetworkId) {
      throw new WcPayError({
        code: EWcPayErrorCode.UnsupportedChain,
        message: `Unsupported WalletConnect Pay chain: ${chainId}`,
      });
    }
    const expectedNamespace =
      WC_PAY_METHOD_NAMESPACES[method as EWcPayActionMethod];
    if (expectedNamespace && !chainId.startsWith(`${expectedNamespace}:`)) {
      throw new WcPayError({
        code: EWcPayErrorCode.MethodChainMismatch,
        message: `WalletConnect Pay method ${method} does not match chain ${chainId}`,
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(params);
    } catch {
      throw new WcPayError({
        code: EWcPayErrorCode.InvalidActionParams,
        message: `Invalid WalletConnect Pay action params: ${method}`,
      });
    }
    // minimal per-method shape checks mirroring what the executor extracts
    switch (method) {
      case EWcPayActionMethod.EthSendTransaction: {
        const tx = Array.isArray(parsed) ? parsed[0] : parsed;
        if (typeof tx !== 'object' || tx === null || Array.isArray(tx)) {
          throw new WcPayError({
            code: EWcPayErrorCode.InvalidActionParams,
            message: 'Invalid eth_sendTransaction params',
          });
        }
        break;
      }
      case EWcPayActionMethod.EthSignTypedDataV4: {
        // throws when no typed-data payload can be extracted; the executor
        // calls the exact same function, so passing here guarantees the
        // executor resolves the same payload later
        extractWcPayTypedDataMessage(parsed);
        break;
      }
      case EWcPayActionMethod.PersonalSign: {
        // throws when no message can be extracted (same function as executor)
        extractWcPayPersonalSignMessage({ parsed });
        break;
      }
      case EWcPayActionMethod.SolanaSignTransaction: {
        // throws when no transaction payload can be extracted, or when it
        // is not decodable / size-sane base64 — the executor calls this
        // exact pair before pushing the confirm modal
        const encodedTx = wcPaySolanaTxToEncodedTx(
          extractWcPaySolanaTransaction(parsed),
        );
        // The pair above never deserializes the bytes; the executor's first
        // structural parse happens inside the sol vault at this action's own
        // index, i.e. after an earlier eth_sendTransaction in the same list
        // has already broadcast. Decode here with the same parser so a
        // malformed blob fails the whole list up front. Lazy: keeps
        // @solana/web3.js out of the background startup graph.
        const { assertWcPaySolanaEncodedTxParses } =
          await import('./wcPaySolanaConsistency');
        assertWcPaySolanaEncodedTxParses(encodedTx);
        break;
      }
      default:
        throw new WcPayError({
          code: EWcPayErrorCode.UnsupportedMethod,
          message: `Unsupported WalletConnect Pay method: ${method}`,
        });
    }
  }
}

@backgroundClass()
class ServiceWalletConnectPay extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async getPayClient() {
    const client = await walletConnectClients.getWalletSideClient();
    if (!client.pay) {
      throw new WcPayError({
        code: EWcPayErrorCode.NotAvailable,
        message: 'WalletConnect Pay is not available',
      });
    }
    return client.pay;
  }

  @backgroundMethod()
  async isPaymentLink({ uri }: { uri: string }): Promise<boolean> {
    if (!uri || typeof uri !== 'string') {
      return false;
    }
    // Pay on extension is deferred (MV3 wasm CSP)
    if (platformEnv.isExtension) {
      return false;
    }
    try {
      // cheap shape/domain filter first so unrelated inputs never pay the
      // cost of loading walletkit — which bundles the whole
      // @walletconnect/pay stack and must stay out of the background startup
      // graph; load it on demand only for plausible payment links.
      // Recognition only: this method doubles as getPaymentOptions' trust
      // gate, so platform capability must NOT be folded in here — entry
      // points surface an explicit refusal instead (useParseQRCode /
      // deeplink), and the options page's upfront refusal is the backstop
      if (!validateWcPayLinkDomain(uri)) {
        return false;
      }
      const { isPaymentLink } = await import('@reown/walletkit');
      return isPaymentLink(uri);
    } catch {
      return false;
    }
  }

  /**
   * Build the CAIP-10 account list to offer for a payment: the EVM address on
   * every Pay-supported eip155 chain plus the Solana address, restricted to
   * networks that exist in the wallet. EVM addresses are identical across
   * eip155 chains, so a single resolution covers all of them. The active
   * account may not cover every impl (e.g. a single-chain imported key), so
   * each impl resolves independently and only fully-empty results throw.
   */
  private async buildPayAccounts({
    accountId,
    indexedAccountId,
  }: {
    accountId?: string;
    indexedAccountId?: string;
  }): Promise<string[]> {
    const { serviceAccount, serviceNetwork } = this.backgroundApi;

    // External accounts broadcast inside their connected wallet during the
    // "signing" step, bypassing the local sign-then-record-then-broadcast
    // pipeline the duplicate-payment boundary depends on; watch-only
    // accounts cannot sign at all. Refuse both here — the service is the
    // trust boundary, the options page renders a dedicated state, and
    // ServiceSend asserts the same as a last line of defense.
    if (!indexedAccountId && accountId) {
      if (
        accountUtils.isExternalAccount({ accountId }) ||
        accountUtils.isWatchingAccount({ accountId })
      ) {
        throw new WcPayError({
          code: EWcPayErrorCode.AccountTypeUnsupported,
          message: 'WalletConnect Pay does not support this account type',
        });
      }
    }

    // honour the user's global derive type (e.g. Ledger Live) so the offered
    // address matches the account shown in the wallet
    const resolveAddress = async (
      networkId: string,
    ): Promise<string | null> => {
      try {
        const deriveType = await serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
        const account = await serviceAccount.getNetworkAccount({
          accountId: indexedAccountId ? undefined : accountId,
          indexedAccountId,
          networkId,
          deriveType,
        });
        return account?.address || null;
      } catch (error) {
        // expected for impls the account cannot derive (single-chain imported
        // keys); logged because the same path also swallows real failures
        // (e.g. transient db errors) that would otherwise vanish silently
        console.error('wcPay buildPayAccounts skip network', networkId, error);
        return null;
      }
    };

    const accounts: string[] = [];

    const evmAddress = await resolveAddress(getNetworkIdsMap().eth);
    if (evmAddress) {
      for (const ref of WALLET_CONNECT_PAY_EIP155_CHAIN_REFS) {
        const network = await serviceNetwork.getNetworkSafe({
          networkId: `evm--${ref}`,
        });
        if (network) {
          accounts.push(`eip155:${ref}:${evmAddress}`);
        }
      }
    }

    for (const [ref, networkId] of Object.entries(
      WALLET_CONNECT_PAY_SOLANA_CHAINS,
    )) {
      const network = await serviceNetwork.getNetworkSafe({ networkId });
      if (network) {
        const solAddress = await resolveAddress(networkId);
        if (solAddress) {
          accounts.push(`solana:${ref}:${solAddress}`);
        }
      }
    }

    if (accounts.length === 0) {
      throw new WcPayError({
        code: EWcPayErrorCode.NoSupportedNetworks,
        message: 'No supported networks for WalletConnect Pay',
      });
    }
    return accounts;
  }

  @backgroundMethod()
  async getPaymentOptions({
    paymentLink,
    accountId,
    indexedAccountId,
  }: {
    paymentLink: string;
    accountId?: string;
    indexedAccountId?: string;
  }): Promise<IWcPayOptionsResult> {
    // the QR/deeplink entry runs this same check, but the service is the
    // real trust boundary: any internal caller reaching this background
    // method must present a link passing the same shape + domain validation,
    // so an attacker-controlled link can never reach the Pay SDK by
    // bypassing the UI entry
    if (!(await this.isPaymentLink({ uri: paymentLink }))) {
      throw new WcPayError({
        code: EWcPayErrorCode.InvalidPaymentLink,
        message: 'Invalid WalletConnect Pay payment link',
      });
    }
    const pay = await this.getPayClient();
    const accounts = await this.buildPayAccounts({
      accountId,
      indexedAccountId,
    });
    const result = await pay.getPaymentOptions({
      paymentLink,
      accounts,
      includePaymentInfo: true,
    });
    return result as IWcPayOptionsResult;
  }

  @backgroundMethod()
  async getRequiredPaymentActions({
    paymentId,
    optionId,
  }: {
    paymentId: string;
    optionId: string;
  }) {
    const pay = await this.getPayClient();
    const actions = await pay.getRequiredPaymentActions({
      paymentId,
      optionId,
    });
    await validateWcPayActions(actions);
    // Final backstop: the options page also runs this check before the
    // compliance form (so KYC is never collected for a payment that cannot
    // finish here). option.actions can be empty or diverge from this list,
    // so the gate must still run on the freshly fetched actions.
    if (
      shouldRefuseWcPayWithoutDurableProgress({
        actions,
        supportsDurableProgress: await this.supportsDurableProgress(),
      })
    ) {
      throw new WcPayError({
        code: EWcPayErrorCode.BroadcastUnsupported,
        message: 'On-chain payments are not supported on this platform',
      });
    }
    return actions;
  }

  /**
   * Whether action progress can be encrypted at rest. Broadcast-capable
   * payments must not start when this is false (bare web, desktop without
   * safeStorage): a process death after broadcast would otherwise retry
   * with no stored txid and send the payment twice.
   */
  @backgroundMethod()
  async supportsDurableProgress(): Promise<boolean> {
    try {
      return await this.backgroundApi.simpleDb.walletConnectPay.supportsDurableProgress();
    } catch {
      return false;
    }
  }

  /**
   * Results of actions already completed by an earlier attempt of the same
   * payment+option+account, validated against the freshly fetched action
   * list. Progress lives in the background (index in simpleDb, sensitive
   * payload in secureStorage) rather than UI memory: on native the UI
   * runtime can be reclaimed while a broadcast transaction is still
   * confirming, and a resumed attempt must know the transaction was already
   * sent. Stored entries transfer only while every one matches the
   * same-index action of `actions` — the server may recompute the list
   * between attempts (e.g. drop an approve whose allowance is already
   * satisfied), and replaying results purely by position would then submit
   * wrong data silently.
   */
  @backgroundMethod()
  async getStoredActionResults({
    paymentId,
    optionId,
    accountKey,
    actions,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    actions: IWcPayAction[];
  }): Promise<string[]> {
    let record: IWcPayStoredProgress | undefined;
    try {
      record = await this.backgroundApi.simpleDb.walletConnectPay.getProgress({
        paymentId,
        optionId,
        accountKey,
      });
    } catch (error) {
      // the rewrites below intentionally hide raw storage detail from the
      // UI; keep the true cause in the log
      console.error('wcPay getProgress failed', error);
      const message = (error as Error | undefined)?.message;
      if (message === WC_PAY_PROGRESS_CORRUPT_ERROR) {
        // deterministic corruption: re-reading can never heal it, so the
        // refusal carries the distinct code the UI maps to an explicit
        // user-confirmed discard (discardActionResultsFrom fromIndex 0) —
        // the only deletion path open to an undecodable record
        throw new WcPayError({
          code: EWcPayErrorCode.ProgressDamaged,
          message:
            'Saved progress for this payment is damaged and cannot be resumed',
        });
      }
      if (message === WC_PAY_PROGRESS_UNREADABLE_ERROR) {
        // transient read failure (locked keychain, platform hiccup): the
        // record may hold a broadcast txid, so starting a fresh attempt
        // could pay twice. Refuse this attempt and keep the record — same
        // policy as the broadcast-beyond-hole case below; a later attempt,
        // the server-side final state, or the TTL resolves it.
        throw new WcPayError({
          code: EWcPayErrorCode.CannotResumeOnDevice,
          message: 'This payment cannot be resumed safely on this device',
        });
      }
      // anything else (e.g. an index-cleanup write failing inside
      // getProgress) is not a resume-safety verdict; surface it as-is
      throw error;
    }
    if (!record?.entries?.length) {
      return [];
    }
    // saveActionResult enforces a dense prefix, but a record persisted by an
    // older build (or a partially failed write) may still carry `null`
    // holes. A hole is a LOCAL storage defect, not a server-side action
    // recompute, so it must not discard the record: entries past a hole can
    // no longer be aligned to their action index, but the contiguous prefix
    // is still trustworthy.
    let prefixLength = 0;
    while (
      prefixLength < record.entries.length &&
      record.entries[prefixLength]
    ) {
      prefixLength += 1;
    }
    if (prefixLength < record.entries.length) {
      const hasBroadcastBeyondHole = record.entries
        .slice(prefixLength)
        .some((entry) => entry?.broadcastMeta);
      if (hasBroadcastBeyondHole) {
        // a broadcast txid sits past the hole: resuming from the prefix
        // would re-execute that action from scratch with a fresh nonce — a
        // second on-chain payment. Refuse the attempt instead of deleting
        // the txid-bearing record; the server-side final state (or the TTL)
        // still cleans it up.
        throw new WcPayError({
          code: EWcPayErrorCode.CannotResumeOnDevice,
          message: 'This payment cannot be resumed safely on this device',
        });
      }
    }
    const entries = record.entries.slice(0, prefixLength);
    const isMatching = entries.every((entry, index) => {
      if (!actions[index]) {
        return false;
      }
      const fingerprint = getWcPayActionFingerprint(actions[index]);
      // null means unparseable params: such an action can never legitimately
      // match stored progress, so the whole record is discarded below
      return fingerprint !== null && entry.fingerprint === fingerprint;
    });
    if (!isMatching) {
      const hasBroadcastEvidence = entries.some((entry) => entry.broadcastMeta);
      if (hasBroadcastEvidence) {
        // a stored entry carries a broadcast txid: deleting it would destroy
        // the only duplicate-payment evidence, and the fresh attempt the
        // deletion enables could pay twice. Same policy as the
        // broadcast-beyond-hole case above — refuse this attempt and keep
        // the record; the server-side final state or the TTL resolves it.
        throw new WcPayError({
          code: EWcPayErrorCode.CannotResumeOnDevice,
          message: 'This payment cannot be resumed safely on this device',
        });
      }
      // fingerprint divergence means the server recomputed the action list;
      // replaying results by position would submit wrong data silently
      await this.backgroundApi.simpleDb.walletConnectPay.removeProgress({
        paymentId,
        optionId,
        accountKey,
      });
      return [];
    }
    return entries.map((entry) => entry.result);
  }

  /**
   * Persist one completed action result. The executor awaits this call
   * before moving to the next action, so a broadcast transaction is durably
   * recorded even if the app is killed immediately afterwards.
   */
  @backgroundMethod()
  async recordActionResult({
    paymentId,
    optionId,
    accountKey,
    action,
    index,
    result,
    broadcastMeta,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    action: IWcPayAction;
    index: number;
    result: string;
    broadcastMeta?: IWcPayBroadcastMeta;
  }): Promise<void> {
    const fingerprint = getWcPayActionFingerprint(action);
    if (fingerprint === null) {
      // validateWcPayActions guarantees parseable params before any action
      // executes, so this only fires when the API is misused
      throw new WcPayError({
        code: EWcPayErrorCode.InvalidActionParams,
        message: 'Invalid WalletConnect Pay action params',
      });
    }
    await this.backgroundApi.simpleDb.walletConnectPay.saveActionResult({
      paymentId,
      optionId,
      accountKey,
      index,
      fingerprint,
      result,
      broadcastMeta,
    });
  }

  /**
   * Duplicate-payment boundary for broadcast-capable actions. Called by
   * ServiceSend in the background between signing and broadcast, so the
   * txid is durably recorded before the transaction can reach the chain —
   * the UI runtime dying mid-confirm can then never lose an already-sent
   * transfer. Throws (aborting the broadcast) when the record cannot be
   * persisted: failing closed costs one retry, broadcasting unrecorded can
   * charge the user twice.
   */
  @backgroundMethod()
  async recordPreBroadcastTxid({
    record,
    txid,
    broadcastMeta,
  }: {
    record: IWcPayPreBroadcastRecord;
    txid: string;
    broadcastMeta?: IWcPayBroadcastMeta;
  }): Promise<void> {
    if (!txid) {
      throw new WcPayError({
        code: EWcPayErrorCode.MissingTxid,
        message: 'Missing WalletConnect Pay transaction id',
      });
    }
    if (!(await this.supportsDurableProgress())) {
      // broadcast-capable flows are refused upfront on such platforms;
      // reaching this means a gate was bypassed — never broadcast unrecorded
      throw new WcPayError({
        code: EWcPayErrorCode.BroadcastUnsupported,
        message: 'On-chain payments are not supported on this platform',
      });
    }
    await this.recordActionResult({
      paymentId: record.paymentId,
      optionId: record.optionId,
      accountKey: record.accountKey,
      action: record.action,
      index: record.index,
      result: txid,
      broadcastMeta,
    });
  }

  /**
   * Drop stored results from `fromIndex` on. Used when a recorded
   * transaction is later found reverted on chain: its txid can never be
   * resumed, so keeping it would deadlock the payment option until TTL.
   */
  @backgroundMethod()
  async discardActionResultsFrom({
    paymentId,
    optionId,
    accountKey,
    fromIndex,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    fromIndex: number;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.walletConnectPay.truncateActionResults({
      paymentId,
      optionId,
      accountKey,
      fromIndex,
    });
  }

  /**
   * Submit signatures for the selected option. Also used for status polling:
   * when the response is not final, call again after `pollInMs`.
   */
  @backgroundMethod()
  async confirmPayment({
    paymentId,
    optionId,
    signatures,
  }: {
    paymentId: string;
    optionId: string;
    signatures: string[];
  }): Promise<IWcPayConfirmResult> {
    const pay = await this.getPayClient();
    const result = (await pay.confirmPayment({
      paymentId,
      optionId,
      signatures,
    })) as IWcPayConfirmResult;
    if (result.isFinal) {
      // a final server state ends the payment's lifecycle: stored progress
      // can never be resumed and must not linger where a future attempt of a
      // different payment could be confused by it. Cleanup failure must not
      // mask the confirm result itself.
      try {
        await this.backgroundApi.simpleDb.walletConnectPay.clearPaymentProgress(
          { paymentId },
        );
      } catch (error) {
        console.error('wcPay clearPaymentProgress failed', error);
      }
    }
    return result;
  }

  /**
   * Wait until an EVM transaction is mined. Needed for the USDT/Permit2
   * two-action flow: the approve transaction must be confirmed on-chain
   * before the follow-up Permit2 typed data may be signed.
   *
   * A definitively reverted receipt is reported via the return value (not a
   * thrown error) so callers can tell it apart from timeout/RPC uncertainty
   * — reverted txids must be discarded from stored progress while uncertain
   * ones must be kept to avoid re-broadcasting.
   */
  @backgroundMethod()
  async waitForTxMined({
    networkId,
    txid,
    timeoutMs = 180_000,
  }: {
    networkId: string;
    txid: string;
    timeoutMs?: number;
  }): Promise<{ isReverted: boolean }> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      // vault.getRpcUrl() is only an unimplemented base-class stub (returns
      // ''), so the receipt must be read through the wallet backend RPC proxy
      // — the same path dapp eth_* calls take — which also routes custom
      // networks to their configured RPC.
      const receipt = await this.backgroundApi.serviceDApp
        .proxyRPCCall<{ status?: string } | null>({
          networkId,
          request: {
            method: 'eth_getTransactionReceipt',
            params: [txid],
          },
          origin: `https://${WALLET_CONNECT_PAY_TRUSTED_HOST}`,
        })
        // on preset networks proxyRPCCall returns the parseRPCResponse
        // promises unresolved inside the array (see isTxNeverBroadcast), so
        // the element must be awaited before narrowing to the receipt shape
        // — the bare promise object is truthy and would read as a mined,
        // non-reverted receipt
        .then(async ([result]) => (await result) as { status?: string } | null)
        .catch(() => null);
      if (receipt) {
        return { isReverted: !!receipt.status && receipt.status !== '0x1' };
      }
      if (Date.now() > deadline) {
        throw new WcPayError({
          code: EWcPayErrorCode.TxConfirmationTimeout,
          message: 'Timed out waiting for transaction confirmation',
        });
      }
      await timerUtils.wait(3000);
    }
  }

  /**
   * Distinguish "never broadcast" from "broadcast but not yet confirmed"
   * for a txid restored from durable progress. The pre-broadcast record is
   * written before the broadcast attempt, so a definitive broadcast
   * rejection leaves a phantom txid behind; a resumed attempt must
   * re-execute that action instead of submitting the phantom result — or a
   * single failed broadcast deadlocks the payment until expiry.
   *
   * eth_getTransactionByHash returning null is the only usable
   * "not broadcast" signal (a missing receipt alone cannot tell pending
   * from nonexistent), affirmed only by several consistent tx+receipt
   * null rounds. The nonce checks that follow are veto-only, not
   * corroboration: a mempool-pending tx and a never-broadcast tx are
   * indistinguishable by confirmed count, and the counts are read through
   * the same RPC proxy pool as the probes, so a pool that cannot see the
   * tx fails both together. They still veto the observable bad states —
   * a consumed nonce (something with this nonce already landed, quite
   * possibly this very tx) and a sender-visible pending tx. Any RPC
   * failure, non-null probe result, or missing broadcast metadata aborts
   * to false: uncertainty always keeps the stored txid.
   *
   * Because a false "never broadcast" verdict remains reachable (tx
   * broadcast but invisible to the probe pool), callers must pin the
   * re-executed transaction to the recorded nonce
   * (getBroadcastMetaByTxid + prepareSendConfirmUnsignedTx nonceInfo) so
   * a misjudgment can only produce a nonce conflict where one tx lands —
   * never a second payment at nonce+1.
   */
  @backgroundMethod()
  async isTxNeverBroadcast({
    networkId,
    txid,
  }: {
    networkId: string;
    txid: string;
  }): Promise<boolean> {
    const rpcCall = async <T>(
      method: string,
      params: unknown[],
    ): Promise<T> => {
      const items = await this.backgroundApi.serviceDApp.proxyRPCCall<T>({
        networkId,
        request: { method, params },
        origin: `https://${WALLET_CONNECT_PAY_TRUSTED_HOST}`,
      });
      if (!items.length) {
        // an empty response envelope is transport-level noise, never a
        // "not found" answer
        throw new WcPayError({
          code: EWcPayErrorCode.EmptyRpcResponse,
          message: 'Empty RPC response',
        });
      }
      // on preset networks proxyRPCCall returns the parseRPCResponse
      // promises unresolved inside the array, so each element must be
      // awaited before it can be inspected
      return (await items[0]) as T;
    };
    const probe = async (
      method: string,
    ): Promise<'found' | 'null' | 'rpcError'> => {
      try {
        const result = await rpcCall<unknown>(method, [txid]);
        return result === null || result === undefined ? 'null' : 'found';
      } catch {
        return 'rpcError';
      }
    };
    for (let round = 0; round < 3; round += 1) {
      if (round > 0) {
        await timerUtils.wait(5000);
      }
      const tx = await probe('eth_getTransactionByHash');
      if (tx !== 'null') {
        return false;
      }
      const receipt = await probe('eth_getTransactionReceipt');
      if (receipt !== 'null') {
        return false;
      }
    }
    try {
      const meta =
        await this.backgroundApi.simpleDb.walletConnectPay.findBroadcastMetaByTxid(
          { txid },
        );
      if (!meta) {
        return false;
      }
      // 'latest' (not the wallet API account nonce, pending-inclusive on
      // some chains): the phantom nonce must be exactly the next confirmed
      // slot — a higher count means it was consumed, a lower one means the
      // account state is inconsistent with the recorded tx
      const confirmedCount = new BigNumber(
        await rpcCall<string>('eth_getTransactionCount', [
          meta.sender,
          'latest',
        ]),
      );
      // and this node must see nothing pending from the sender at all —
      // a pending tx at this nonce is very likely the "phantom" itself
      const pendingCount = new BigNumber(
        await rpcCall<string>('eth_getTransactionCount', [
          meta.sender,
          'pending',
        ]),
      );
      const isNothingAtNonce =
        confirmedCount.isInteger() &&
        pendingCount.isInteger() &&
        confirmedCount.eq(meta.nonce) &&
        pendingCount.eq(confirmedCount);
      if (!isNothingAtNonce) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Pre-broadcast metadata recorded for a txid (sender + nonce), if any.
   * Read it BEFORE invalidating stored progress — invalidation truncates
   * the entry that holds it — so the re-executed action can be pinned to
   * the same nonce (see prepareSendConfirmUnsignedTx nonceInfo).
   */
  @backgroundMethod()
  async getBroadcastMetaByTxid({
    txid,
  }: {
    txid: string;
  }): Promise<IWcPayBroadcastMeta | undefined> {
    return this.backgroundApi.simpleDb.walletConnectPay.findBroadcastMetaByTxid(
      { txid },
    );
  }

  /**
   * Proves a server-supplied `solana_signTransaction` blob matches the
   * approved order. Exposed as a background method rather than called from
   * the UI directly because the validator decodes the blob with
   * `@solana/web3.js`, which must not enter the `@onekeyhq/kit` bundle — on
   * mobile/extension `main` and `bg` are separate JS runtimes (see
   * solPayUtils.ts, which transcodes base64→bs58 for the same reason). The
   * background is also the runtime that signs, so the check runs next to it.
   *
   * The validator module is loaded on demand: a static import would pull
   * @solana/web3.js into the background STARTUP graph for every user, while
   * today it only arrives with the sol vault's own lazy chunk (vaults/
   * factory.ts) — the same rule isPaymentLink applies to walletkit.
   */
  @backgroundMethod()
  async checkSolanaTxMatchesOrder(params: {
    txBase64: string;
    caip2ChainId: string;
    option: IWcPayOption;
  }): Promise<IWcPaySolanaConsistencyResult> {
    const { checkWcPaySolanaTxMatchesOrder } =
      await import('./wcPaySolanaConsistency');
    return checkWcPaySolanaTxMatchesOrder(params);
  }

  /**
   * True when signing changed nothing but the signatures — the belt to
   * checkSolanaTxMatchesOrder's suspenders. Same runtime placement and
   * on-demand load as above.
   */
  @backgroundMethod()
  async isSolanaMessageUnchanged({
    unsignedBase64,
    signedBase64,
  }: {
    unsignedBase64: string;
    signedBase64: string;
  }): Promise<boolean> {
    const { isWcPaySolanaMessageUnchanged } =
      await import('./wcPaySolanaConsistency');
    return isWcPaySolanaMessageUnchanged(unsignedBase64, signedBase64);
  }
}

export default ServiceWalletConnectPay;
