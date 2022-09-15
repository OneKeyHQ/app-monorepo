/* eslint-disable @typescript-eslint/require-await */
import { ISwftcCoin } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntitySwap';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';
import { IEncodedTx, IFeeInfoUnit } from '@onekeyhq/engine/src/vaults/types';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  clearState,
  resetState,
  resetTypedValue,
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
import { SendConfirmParams } from '../../views/Send/types';
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
    dispatch(setQuote(undefined), switchTokens());
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
  async sendTransaction(params: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
    payload?: SendConfirmParams['payloadInfo'];
  }) {
    const { engine, servicePassword, serviceHistory } = this.backgroundApi;

    const password = await servicePassword.getPassword();
    if (!password) {
      throw new Error('Internal Error');
    }

    const { accountId, networkId, encodedTx } = params;

    let feeInfoUnit: IFeeInfoUnit | undefined;

    try {
      const feeInfo = await engine.fetchFeeInfo({
        accountId,
        networkId,
        encodedTx,
      });

      if (Number(feeInfo.limit) <= 0) {
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
      data: { signedTx, decodedTx, encodedTx },
    });

    return { result: signedTx, decodedTx, encodedTx };
  }
}
