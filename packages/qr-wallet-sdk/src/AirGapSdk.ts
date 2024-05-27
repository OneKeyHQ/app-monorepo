import AirGapSdkBase from '@keystonehq/keystone-sdk';

import { AirGapEthereumSDK } from './chains/AirGapEthereumSDK';

export class AirGapSdk extends AirGapSdkBase {
  private _ethAirGap: AirGapEthereumSDK | undefined;

  override get eth() {
    if (!this._ethAirGap) {
      this._ethAirGap = new AirGapEthereumSDK(this.config);
    }
    return this._ethAirGap;
  }
}

let sdk: AirGapSdk | undefined;
export function getAirGapSdk(): AirGapSdk {
  if (!sdk) {
    sdk = new AirGapSdk();
  }
  return sdk;
}
