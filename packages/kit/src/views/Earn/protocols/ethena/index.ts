import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { EarnProtocol } from '../EarnProtocol';

export class EthenaEarnProtocol extends EarnProtocol {
  override getKycAccountScanPolicy(): {
    kind: 'ethena';
    accountImpl: string;
    networkId: string;
  } {
    return {
      kind: 'ethena',
      accountImpl: IMPL_EVM,
      networkId: getNetworkIdsMap().eth,
    };
  }
}
