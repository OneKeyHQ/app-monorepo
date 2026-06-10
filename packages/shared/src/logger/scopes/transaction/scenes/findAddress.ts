import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

// btc find-address feature (OK-55653).
// NEVER log the address or the index: they would link a user's hidden
// (off-gap) funds to their analytics profile.
export class FindAddressScene extends BaseScene {
  @LogToServer()
  public findAddressOpened(params: { networkId: string }) {
    return params;
  }

  @LogToServer()
  public findAddressClaimed(params: { networkId: string; deriveType: string }) {
    return params;
  }

  @LogToServer()
  public claimedAddressRemoved(params: { networkId: string }) {
    return params;
  }

  @LogToServer()
  public claimedAddressCopied(params: { networkId: string }) {
    return params;
  }

  @LogToServer()
  public spendFromClaimed(params: {
    networkId: string;
    claimedUtxoCount: number;
  }) {
    return params;
  }
}
