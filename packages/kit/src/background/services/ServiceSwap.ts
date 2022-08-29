/* eslint-disable @typescript-eslint/require-await */
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  clearState,
  resetState,
  resetTypedValue,
  setApprovalSubmitted,
  setInputToken,
  setOutputToken,
  setQuote,
  setQuoteTime,
  setReceivingNetworkId,
  setRecipient,
  setSendingNetworkId,
  setTypedValue,
  switchTokens,
} from '../../store/reducers/swap';
import { clearAccountTransactions } from '../../store/reducers/swapTransactions';
import { FieldType, QuoteData, Recipient } from '../../views/Swap/typings';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  getNetwork(networkId?: string): Network | undefined {
    if (!networkId) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const networks = appSelector((s) => s.runtime.networks);
    return networks.find((network) => network.id === networkId);
  }

  @backgroundMethod()
  async setApprovalSubmitted(submited: boolean) {
    const { dispatch } = this.backgroundApi;
    dispatch(setApprovalSubmitted(submited));
  }

  @backgroundMethod()
  async selectToken(field: FieldType, network?: Network, token?: Token) {
    const { dispatch } = this.backgroundApi;
    if (field === 'INPUT') {
      dispatch(setInputToken({ token, network }));
      dispatch(setApprovalSubmitted(false));
    } else {
      dispatch(setOutputToken({ token, network }));
    }
  }

  @backgroundMethod()
  async setInputToken(token: Token) {
    const { appSelector } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (
      outputToken &&
      outputToken.networkId === token.networkId &&
      outputToken.tokenIdOnNetwork === token.tokenIdOnNetwork
    ) {
      this.selectToken(
        'OUTPUT',
        this.getNetwork(inputToken?.networkId),
        inputToken,
      );
    }
    this.selectToken('INPUT', this.getNetwork(token.networkId), token);
  }

  @backgroundMethod()
  async setOutputToken(token: Token) {
    const { appSelector } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (
      inputToken &&
      inputToken.networkId === token.networkId &&
      inputToken.tokenIdOnNetwork === token.tokenIdOnNetwork
    ) {
      if (getActiveWalletAccount().networkId !== outputToken?.networkId) {
        this.selectToken('INPUT');
      } else {
        this.selectToken(
          'INPUT',
          this.getNetwork(outputToken?.networkId),
          outputToken,
        );
      }
    }
    this.selectToken('OUTPUT', this.getNetwork(token.networkId), token);
  }

  @backgroundMethod()
  async switchTokens() {
    const { dispatch } = this.backgroundApi;
    dispatch(setQuote(undefined));
    dispatch(switchTokens());
  }

  @backgroundMethod()
  async resetState() {
    const { dispatch } = this.backgroundApi;
    dispatch(resetState());
  }

  @backgroundMethod()
  async userInput(field: FieldType, typedValue: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setTypedValue({ independentField: field, typedValue }));
  }

  @backgroundMethod()
  async setSendingNetworkId(networkId?: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setSendingNetworkId(networkId));
  }

  @backgroundMethod()
  async setReceivingNetworkId(networkId?: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setReceivingNetworkId(networkId));
  }

  @backgroundMethod()
  async resetTypedValue() {
    const { dispatch } = this.backgroundApi;
    dispatch(resetTypedValue());
  }

  @backgroundMethod()
  async clearState() {
    const { dispatch } = this.backgroundApi;
    dispatch(clearState());
  }

  @backgroundMethod()
  async clearAccountTransactions(accountId: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(clearAccountTransactions({ accountId }));
  }

  @backgroundMethod()
  async setQuote(data?: QuoteData) {
    const { dispatch } = this.backgroundApi;
    dispatch(setQuote(data));
    if (data) {
      dispatch(setQuoteTime(Date.now()));
    } else {
      dispatch(setQuoteTime(undefined));
    }
  }

  @backgroundMethod()
  async setRecipient(network: Network): Promise<Recipient | undefined> {
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const recipient = appSelector((s) => s.swap.recipient);
    if (recipient?.address && recipient.networkImpl === network.impl) {
      return recipient;
    }
    const { wallets, networks } = appSelector((s) => s.runtime);
    const { activeNetworkId, activeWalletId, activeAccountId } = appSelector(
      (s) => s.general,
    );
    const activeWallet = wallets.find((item) => item.id === activeWalletId);
    const activeNetwork = networks.find((item) => item.id === activeNetworkId);
    if (!activeWallet || !activeNetwork) {
      return;
    }
    const accounts = await engine.getAccounts(
      activeWallet.accounts,
      network.id,
    );
    const account =
      network.impl === activeNetwork.impl
        ? accounts.find((acc) => acc.id === activeAccountId)
        : accounts[0];
    if (account) {
      const data = {
        address: account.address,
        name: account.name,
        networkId: network.id,
        networkImpl: network.impl,
      };
      dispatch(setRecipient(data));
      return data;
    }
    dispatch(setRecipient());
  }
}
