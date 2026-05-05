import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IWsAllMids } from '@onekeyhq/shared/types/hyperliquid/sdk';

ensureRunOnBackground();

class HyperLiquidCache {
  private _allMids?: IWsAllMids;

  private _allMidsUpdatedAt = 0;

  get allMids() {
    return this._allMids;
  }

  set allMids(allMids: IWsAllMids | undefined) {
    this._allMids = allMids;
    this._allMidsUpdatedAt = allMids ? Date.now() : 0;
  }

  get allMidsUpdatedAt() {
    return this._allMidsUpdatedAt;
  }

  public activatedUser: {
    [address: string]: boolean;
  } = {};

  public referrerCodeSetDone: {
    [addressAndAgentName: string]: boolean;
  } = {};
}

export default new HyperLiquidCache();
