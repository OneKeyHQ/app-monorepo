import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import { ActionBase } from './ActionBase';

import type { IActionProps } from './type';

const ActionBuy = ({ networkId, tokenAddress, accountId }: IActionProps) => (
  <ActionBase
    networkId={networkId}
    tokenAddress={tokenAddress}
    accountId={accountId}
    label="Buy"
    icon="PlusLargeOutline"
    type="buy"
  />
);

export default withBrowserProvider<IActionProps>(ActionBuy);
