import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WC_PAY_BROADCAST_UNSUPPORTED_MESSAGE,
  shouldRefuseWcPayWithoutDurableProgress,
} from '@onekeyhq/shared/src/walletConnect/payBroadcastUtils';
import {
  WALLET_CONNECT_PAY_EIP155_CHAIN_REFS,
  WALLET_CONNECT_PAY_SOLANA_CHAINS,
  validateWcPayLinkDomain,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAction,
  IWcPayConfirmResult,
  IWcPayOptionsResult,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import { vaultFactory } from '../../vaults/factory';
import ServiceBase from '../ServiceBase';
import walletConnectClients from '../ServiceWalletConnect/walletConnectClient';

import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from './evmPayUtils';
import { getWcPayActionFingerprint } from './payFingerprintUtils';
import { extractWcPaySolanaTransaction } from './solPayUtils';

/**
 * Validate the whole action list before it reaches the executor. Actions run
 * sequentially and the leading ones may broadcast transactions, so a defect
 * in a later action (unknown chain/method, unparseable JSON params, wrong
 * param shape) must fail the flow here — before any signing starts — instead
 * of midway through, where the payment would be stranded partially completed.
 */
function validateWcPayActions(actions: IWcPayAction[]) {
  for (const action of actions) {
    const { chainId, method, params } = action.walletRpc;
    const targetNetworkId = wcPayChainIdToNetworkId(chainId);
    if (!targetNetworkId) {
      throw new OneKeyError(`Unsupported WalletConnect Pay chain: ${chainId}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(params);
    } catch {
      throw new OneKeyError(
        `Invalid WalletConnect Pay action params: ${method}`,
      );
    }
    // minimal per-method shape checks mirroring what the executor extracts
    switch (method) {
      case EWcPayActionMethod.EthSendTransaction: {
        const tx = Array.isArray(parsed) ? parsed[0] : parsed;
        if (typeof tx !== 'object' || tx === null || Array.isArray(tx)) {
          throw new OneKeyError('Invalid eth_sendTransaction params');
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
        // throws when no transaction payload can be extracted
        extractWcPaySolanaTransaction(parsed);
        break;
      }
      default:
        throw new OneKeyError(
          `Unsupported WalletConnect Pay method: ${method}`,
        );
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
      throw new OneKeyError('WalletConnect Pay is not available');
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
      // walletkit (which bundles the whole @walletconnect/pay stack) must stay
      // out of the background startup graph; load it on demand
      const { isPaymentLink } = await import('@reown/walletkit');
      return isPaymentLink(uri) && validateWcPayLinkDomain(uri);
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
      throw new OneKeyError('No supported networks for WalletConnect Pay');
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
      throw new OneKeyError('Invalid WalletConnect Pay payment link');
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
    validateWcPayActions(actions);
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
      throw new OneKeyError(WC_PAY_BROADCAST_UNSUPPORTED_MESSAGE);
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
    const record =
      await this.backgroundApi.simpleDb.walletConnectPay.getProgress({
        paymentId,
        optionId,
        accountKey,
      });
    if (!record?.entries?.length) {
      return [];
    }
    const isMatching = record.entries.every((entry, index) => {
      if (!entry || !actions[index]) {
        return false;
      }
      const fingerprint = getWcPayActionFingerprint(actions[index]);
      // null means unparseable params: such an action can never legitimately
      // match stored progress, so the whole record is discarded below
      return fingerprint !== null && entry.fingerprint === fingerprint;
    });
    if (!isMatching) {
      await this.backgroundApi.simpleDb.walletConnectPay.removeProgress({
        paymentId,
        optionId,
        accountKey,
      });
      return [];
    }
    return record.entries.map((entry) => entry.result);
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
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    action: IWcPayAction;
    index: number;
    result: string;
  }): Promise<void> {
    const fingerprint = getWcPayActionFingerprint(action);
    if (fingerprint === null) {
      // validateWcPayActions guarantees parseable params before any action
      // executes, so this only fires when the API is misused
      throw new OneKeyError('Invalid WalletConnect Pay action params');
    }
    await this.backgroundApi.simpleDb.walletConnectPay.saveActionResult({
      paymentId,
      optionId,
      accountKey,
      index,
      fingerprint,
      result,
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
    accountId,
    txid,
    timeoutMs = 180_000,
  }: {
    networkId: string;
    accountId: string;
    txid: string;
    timeoutMs?: number;
  }): Promise<{ isReverted: boolean }> {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const rpcUrl = await vault.getRpcUrl();
    const { ClientEvm } =
      await import('../../vaults/impls/evm/sdkEvm/ClientEvm');
    const client = new ClientEvm(rpcUrl);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const receipt = await client
        .call<{ status?: string } | null>('eth_getTransactionReceipt', [txid])
        .catch(() => null);
      if (receipt) {
        return { isReverted: !!receipt.status && receipt.status !== '0x1' };
      }
      if (Date.now() > deadline) {
        throw new OneKeyError('Timed out waiting for transaction confirmation');
      }
      await timerUtils.wait(3000);
    }
  }
}

export default ServiceWalletConnectPay;
