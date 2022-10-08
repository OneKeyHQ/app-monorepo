/* eslint-disable @typescript-eslint/require-await */
import { ISwftcCoin } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntitySwap';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';
import { IEncodedTx, IFeeInfoUnit } from '@onekeyhq/engine/src/vaults/types';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  clearState,
  resetState,
  resetTypedValue,
  setInputToken,
  setNetworkSelectorId,
  setOutputToken,
  setQuote,
  setQuoteTime,
  setRecipient,
  setSendingAccount,
  setTypedValue,
  switchTokens,
} from '../../store/reducers/swap';
import { clearAccountTransactions } from '../../store/reducers/swapTransactions';
import { SendConfirmParams } from '../../views/Send/types';
import { enabledNetworkIds } from '../../views/Swap/config';
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
  async getSwftcCoins() {
    return simpleDb.swap.getSwftcCoins();
  }

  @backgroundMethod()
  async setSwftcCoins(coins: ISwftcCoin[]) {
    return simpleDb.swap.setSwftcCoins(coins);
  }

  @backgroundMethod()
  async selectToken(field: FieldType, network?: Network, token?: Token) {
    const { dispatch } = this.backgroundApi;
    if (field === 'INPUT') {
      dispatch(setInputToken({ token, network }));
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
    this.setSendingAccountByNetwork(this.getNetwork(token.networkId));
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
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    dispatch(setQuote(undefined), switchTokens());
    if (outputToken) {
      const network = await engine.getNetwork(outputToken.networkId);
      this.setSendingAccountByNetwork(network);
    }
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
  async setNetworkSelectorId(networkId?: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setNetworkSelectorId(networkId));
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
    const actions: any[] = [setQuote(data)];
    if (data) {
      actions.push(setQuoteTime(Date.now()));
    } else {
      actions.push(setQuoteTime(undefined));
    }
    dispatch(...actions);
  }

  @backgroundMethod()
  async getSwapInputToken() {
    const { appSelector } = this.backgroundApi;
    const inputToken = appSelector((s) => s.swap.inputToken);
    return inputToken;
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

  @backgroundMethod()
  async refreshSendingAccount() {
    const { appSelector, engine } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.swap.sendingAccount);
    if (sendingAccount !== null) {
      return;
    }
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (!inputToken) {
      return;
    }
    const network = await engine.getNetwork(inputToken.networkId);
    this.setSendingAccountByNetwork(network);
  }

  @backgroundMethod()
  async setSendingAccountByNetwork(
    network?: Network,
  ): Promise<Account | undefined> {
    if (!network) {
      return;
    }
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.swap.sendingAccount);
    if (
      sendingAccount &&
      isAccountCompatibleWithNetwork(sendingAccount.id, network.id)
    ) {
      return sendingAccount;
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
      const data = { ...account, impl: network.impl };
      dispatch(setSendingAccount(data));
      return data;
    }

    const inactiveWallets = wallets.filter(
      (wallet) => wallet.id !== activeAccountId,
    );
    if (inactiveWallets.length === 0) {
      return;
    }

    for (let i = 0; i < inactiveWallets.length; i += 1) {
      const wallet = inactiveWallets[i];
      const items = await engine.getAccounts(wallet.accounts, network.id);
      if (items.length > 0) {
        dispatch(setSendingAccount(items[0]));
        return;
      }
    }

    dispatch(setSendingAccount(null));
  }

  @backgroundMethod()
  async getAccountRelatedWallet(accountId: string) {
    const { appSelector } = this.backgroundApi;
    const { wallets } = appSelector((s) => s.runtime);
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[0];
      const { accounts } = wallet;
      if (accounts.includes(accountId)) {
        return wallet;
      }
    }
  }

  @backgroundMethod()
  async sendTransaction(params: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
    payload?: SendConfirmParams['payloadInfo'];
  }) {
    const { accountId, networkId, encodedTx } = params;
    const { engine, servicePassword, serviceHistory } = this.backgroundApi;

    const wallets = await engine.getWallets();
    const activeWallet = wallets.find((wallet) =>
      wallet.accounts.includes(accountId),
    );

    let password: string | undefined;
    if (activeWallet?.type === 'hw') {
      password = '';
    } else {
      password = await servicePassword.getPassword();
    }

    if (password === undefined) {
      throw new Error('Internal Error');
    }

    let feeInfoUnit: IFeeInfoUnit | undefined;

    try {
      const feeInfo = await engine.fetchFeeInfo({
        accountId,
        networkId,
        encodedTx,
      });

      if (Number.isNaN(Number(feeInfo.limit)) || Number(feeInfo.limit) <= 0) {
        throw Error('bad limit');
      }

      const price = feeInfo.prices[feeInfo.prices.length - 1];

      feeInfoUnit = {
        eip1559: feeInfo.eip1559,
        limit: feeInfo.limit,
        price,
      };
    } catch {
      const gasPrice = await engine.getGasPrice(params.networkId);

      const blockData = await engine.proxyJsonRPCCall(params.networkId, {
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      });

      const blockReceipt = blockData as { gasLimit: string };

      feeInfoUnit = {
        eip1559: typeof gasPrice[0] === 'object',
        limit: String(+blockReceipt.gasLimit / 10),
        price: gasPrice[gasPrice.length - 1],
      };
    }

    const encodedTxWithFee = await engine.attachFeeInfoToEncodedTx({
      networkId,
      accountId,
      encodedTx,
      feeInfoValue: feeInfoUnit,
    });

    const signedTx = await engine.signAndSendEncodedTx({
      encodedTx: encodedTxWithFee,
      networkId,
      accountId,
      password,
      signOnly: false,
    });

    const { decodedTx } = await engine.decodeTx({
      networkId,
      accountId,
      encodedTx: signedTx.encodedTx,
      payload: params.payload,
    });

    await serviceHistory.saveSendConfirmHistory({
      networkId,
      accountId,
      data: { signedTx, decodedTx, encodedTx: signedTx.encodedTx },
    });

    return { result: signedTx, decodedTx, encodedTx: signedTx.encodedTx };
  }

  @backgroundMethod()
  async searchTokens({
    networkId,
    keyword,
  }: {
    networkId?: string;
    keyword?: string;
  }) {
    const { engine } = this.backgroundApi;
    if (!keyword || !keyword.trim()) {
      return [];
    }
    const term = keyword.trim();
    const tokens = await engine.searchTokens(networkId, term);
    return tokens.filter((t) => enabledNetworkIds.includes(t.networkId));
  }

  @backgroundMethod()
  async checkAccountInWallets(accountId: string) {
    const { engine } = this.backgroundApi;
    const wallets = await engine.getWallets();
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[i];
      if (wallet.accounts.includes(accountId)) {
        return true;
      }
    }
    return false;
  }
}
