/* eslint-disable @typescript-eslint/require-await */
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

import {
  setApprovalSubmitted,
  setInputToken,
  setOutputToken,
  setQuote,
  switchTokens,
} from '../../store/reducers/swap';
import { IndependentFieldType } from '../../views/Swap/typings';
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
  async selectToken(
    field: IndependentFieldType,
    network: Network,
    token: Token,
  ) {
    const { dispatch } = this.backgroundApi;
    if (field === 'INPUT') {
      dispatch(setInputToken({ token, network }));
      dispatch(setApprovalSubmitted(false));
    } else {
      dispatch(setOutputToken({ token, network }));
    }
  }

  @backgroundMethod()
  switchTokens() {
    const { dispatch } = this.backgroundApi;
    dispatch(setQuote(undefined));
    dispatch(switchTokens());
  }
}
