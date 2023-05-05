import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { XmrDisabledInfo } from './XmrDisabledInfo';

export function NetWorkDisabledInfo({
  networkId,
}: {
  networkId?: string;
  accountId?: string;
}) {
  if (networkId === OnekeyNetwork.xmr) {
    return <XmrDisabledInfo />;
  }

  return null;
}
