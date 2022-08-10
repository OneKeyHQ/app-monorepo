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
  setSelectedNetworkId,
  setTypedValue,
  switchTokens,
} from '../../store/reducers/swap';
import { FieldType } from '../../views/Swap/typings';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  getNetwork(networkId?: string): Network | undefined {
    if (!networkId) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const networks = appSelector((s) => s.runtime.networks) as Network[];
    return networks.filter((network) => network.id === networkId)[0];
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
    const outputToken = appSelector((s) => s.swap.outputToken) as
      | Token
      | undefined;
    const inputToken = appSelector((s) => s.swap.inputToken) as
      | Token
      | undefined;
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
    const outputToken = appSelector((s) => s.swap.outputToken) as
      | Token
      | undefined;
    const inputToken = appSelector((s) => s.swap.inputToken) as
      | Token
      | undefined;
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
  async selectNetworkId(networkId?: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setSelectedNetworkId(networkId));
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
}
