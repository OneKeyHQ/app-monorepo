/* eslint-disable @typescript-eslint/require-await */
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

import {
  resetState,
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
  @backgroundMethod()
  async setApprovalSubmitted(submited: boolean) {
    const { dispatch } = this.backgroundApi;
    dispatch(setApprovalSubmitted(submited));
  }

  @backgroundMethod()
  async selectToken(field: FieldType, network: Network, token: Token) {
    const { dispatch } = this.backgroundApi;
    if (field === 'INPUT') {
      dispatch(setInputToken({ token, network }));
      dispatch(setApprovalSubmitted(false));
    } else {
      dispatch(setOutputToken({ token, network }));
    }
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
}
