import { isPaymentLink } from '@reown/walletkit';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  WALLET_CONNECT_PAY_EIP155_CHAIN_REFS,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import type {
  IWcPayConfirmResult,
  IWcPayOptionsResult,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

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
    try {
      return isPaymentLink(uri);
    } catch {
      return false;
    }
  }

  /**
   * Build the CAIP-10 account list to offer for a payment: the account's EVM
   * address on every WalletConnect-Pay-supported chain that exists in the
   * wallet. EVM addresses are identical across eip155 chains, so a single
   * address resolution covers all of them.
   */
  private async buildPayAccounts({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<string[]> {
    const { serviceAccount, serviceNetwork } = this.backgroundApi;
    const address = await serviceAccount.getAccountAddressForApi({
      accountId,
      networkId,
    });
    if (!address) {
      throw new OneKeyError('Account address not found');
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
    networkId,
  }: {
    paymentLink: string;
    accountId: string;
    networkId: string;
  }): Promise<IWcPayOptionsResult> {
    const pay = await this.getPayClient();
    const accounts = await this.buildPayAccounts({ accountId, networkId });
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
}

export default ServiceWalletConnectPay;
