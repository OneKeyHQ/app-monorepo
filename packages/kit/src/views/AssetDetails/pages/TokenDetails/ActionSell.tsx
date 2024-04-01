import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import { ActionBase } from './ActionBase';

import type { IActionProps } from './type';

const ActionSell = ({ networkId, tokenAddress, accountId }: IActionProps) => (
  <ActionBase
    networkId={networkId}
    tokenAddress={tokenAddress}
    accountId={accountId}
    label="Sell"
    icon="MinusLargeOutline"
    type="sell"
  />
);

export default withBrowserProvider<IActionProps>(ActionSell);
