import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { HardwareDisabledInfo, XmrDisabledInfo } from './XmrDisabledInfo';

export function NetWorkDisabledInfo({
  networkId,
}: {
  networkId?: string;
  accountId?: string;
}) {
  if (networkId === OnekeyNetwork.xmr) {
    return <XmrDisabledInfo />;
  }

  if (
    networkId &&
    [OnekeyNetwork.lightning, OnekeyNetwork.tlightning].includes(networkId)
  ) {
    return <HardwareDisabledInfo networkId={networkId} />;
  }

  return null;
}
