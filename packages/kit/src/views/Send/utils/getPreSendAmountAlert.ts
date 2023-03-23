import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { XmrAlert } from '../components/PreSendAmountAlert';

export function getPreSendAmountAlert(networkId: string) {
  if (networkId === OnekeyNetwork.xmr) {
    return XmrAlert;
  }
}
