import { useMedia } from '@onekeyhq/components';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerRewardCenter({
  num,
  linkNetworkId,
}: {
  num: number;
  linkNetworkId?: string;
}) {
  const media = useMedia();

  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      autoWidthForHome
      num={num}
      linkNetworkId={linkNetworkId}
      showWalletName={media.gtMd}
    />
  );
}
