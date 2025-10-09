import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IWsAllMids } from '@onekeyhq/shared/types/hyperliquid/sdk';

ensureRunOnBackground();

class HyperLiquidCache {
  private _allMids: IWsAllMids = {
    mids: {},
  };

  get allMids() {
    return this._allMids;
  }

  set allMids(allMids: IWsAllMids) {
    this._allMids = allMids;
  }

  public activatedUser: {
    [address: string]: boolean;
  } = {};

  public referrerCodeSetDone: {
    [addressAndAgentName: string]: boolean;
  } = {};
}

export default new HyperLiquidCache();
