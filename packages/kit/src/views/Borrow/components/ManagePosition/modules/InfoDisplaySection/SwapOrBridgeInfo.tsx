import { BorrowSwapOrBridge } from '../../../BorrowSwapOrBridge';

import type { ISwapOrBridgeInfoProps } from '../../types';

export function SwapOrBridgeInfo({
  token,
  accountId,
  networkId,
}: ISwapOrBridgeInfoProps) {
  return (
    <BorrowSwapOrBridge
      token={token}
      accountId={accountId}
      networkId={networkId}
      containerStyle={{
        pt: '$0',
      }}
    />
  );
}
