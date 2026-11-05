import { EarnProtocol } from './EarnProtocol';

export class LidoEarnProtocol extends EarnProtocol {
  override getWithdrawFeePolicy() {
    return { skipEstimate: true, includeTransactionIdentity: false };
  }
}
