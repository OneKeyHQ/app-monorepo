/* eslint-disable max-classes-per-file */
import debugLogger from '../../../debugLogger';
import { FlowLoggerScopeBase } from '../../base/FlowLoggerScopeBase';

import type { LoggerEntity } from '../../../debugLogger';

class SceneCommon {
  selectToken({
    token,
    tokenSendAddress,
    tokenSymbol,
    from,
    accountId,
    networkId,
  }: {
    token?: string;
    tokenSendAddress?: string;
    tokenSymbol?: string;
    from?: string;
    accountId?: string;
    networkId?: string;
  }) {
    return {
      from,
      token,
      tokenSendAddress,
      tokenSymbol,
      accountId,
      networkId,
    };
  }

  inputToAddress({ address }: { address?: string }) {
    return [address];
  }

  inputSendAmount({ amount }: { amount?: string | number }) {
    return [amount];
  }
}

export default class extends FlowLoggerScopeBase {
  protected override scopeName = 'send';

  protected override logger: LoggerEntity = debugLogger.flowSend;

  public common: SceneCommon = this._createSceneProxy('common') as SceneCommon;

  private _common = () => SceneCommon;
}
