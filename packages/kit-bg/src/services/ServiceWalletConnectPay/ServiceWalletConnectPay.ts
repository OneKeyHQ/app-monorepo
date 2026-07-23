import { isPaymentLink } from '@reown/walletkit';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WALLET_CONNECT_PAY_EIP155_CHAIN_REFS,
  validateWcPayLinkDomain,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import type {
  IWcPayConfirmResult,
  IWcPayOptionsResult,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import { vaultFactory } from '../../vaults/factory';
import ServiceBase from '../ServiceBase';
import walletConnectClients from '../ServiceWalletConnect/walletConnectClient';

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
      return isPaymentLink(uri) && validateWcPayLinkDomain(uri);
    } catch {
      return false;
    }
  }

  /**
   * Build the CAIP-10 account list to offer for a payment: the account's EVM
   * address on every WalletConnect-Pay-supported chain that exists in the
   * wallet. EVM addresses are identical across eip155 chains, so a single
   * address resolution covers all of them. The active account may live on a
   * non-EVM network, so the EVM account is resolved through the indexed
   * account when available.
   */
  private async buildPayAccounts({
    accountId,
    indexedAccountId,
  }: {
    accountId?: string;
    indexedAccountId?: string;
  }): Promise<string[]> {
    const { serviceAccount, serviceNetwork } = this.backgroundApi;
    const ethNetworkId = getNetworkIdsMap().eth;
    // honour the user's global derive type (e.g. Ledger Live) so the offered
    // address matches the account shown in the wallet
    const deriveType = await serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId: ethNetworkId,
    });
    const evmAccount = await serviceAccount.getNetworkAccount({
      accountId: indexedAccountId ? undefined : accountId,
      indexedAccountId,
      networkId: ethNetworkId,
      deriveType,
    });
    const address = evmAccount?.address;
    if (!address) {
      throw new OneKeyError('EVM account address not found');
    }
    const chainRefs: string[] = [];
    for (const ref of WALLET_CONNECT_PAY_EIP155_CHAIN_REFS) {
      const network = await serviceNetwork.getNetworkSafe({
        networkId: `evm--${ref}`,
      });
      if (network) {
        chainRefs.push(ref);
      }
    }
    if (chainRefs.length === 0) {
      throw new OneKeyError('No supported networks for WalletConnect Pay');
    }
    return chainRefs.map((ref) => `eip155:${ref}:${address}`);
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
    // Reject unknown chains up-front so the flow fails before any signing
    for (const action of actions) {
      const targetNetworkId = wcPayChainIdToNetworkId(action.walletRpc.chainId);
      if (!targetNetworkId) {
        throw new OneKeyError(
          `Unsupported WalletConnect Pay chain: ${action.walletRpc.chainId}`,
        );
      }
    }
    return actions;
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
    const result = await pay.confirmPayment({
      paymentId,
      optionId,
      signatures,
    });
    return result as IWcPayConfirmResult;
  }

  /**
   * Wait until an EVM transaction is mined. Needed for the USDT/Permit2
   * two-action flow: the approve transaction must be confirmed on-chain
   * before the follow-up Permit2 typed data may be signed.
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
  }): Promise<void> {
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
        if (receipt.status && receipt.status !== '0x1') {
          throw new OneKeyError('Transaction reverted on chain');
        }
        return;
      }
      if (Date.now() > deadline) {
        throw new OneKeyError('Timed out waiting for transaction confirmation');
      }
      await timerUtils.wait(3000);
    }
  }
}

export default ServiceWalletConnectPay;
