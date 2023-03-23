import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { XmrExtraInfo } from './XmrExtraInfo';

export function NetWorkExtraInfo({
  networkId,
  accountId,
}: {
  networkId?: string;
  accountId?: string;
}) {
  if (networkId === OnekeyNetwork.xmr) {
    if (accountId) return <XmrExtraInfo />;
    return null;
  }

  return null;
}
