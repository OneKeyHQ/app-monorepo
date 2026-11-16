import { useMedia } from '@onekeyhq/components';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerRewardCenter({
  num,
  linkNetworkId,
  compact,
}: {
  num: number;
  linkNetworkId?: string;
  compact?: boolean;
}) {
  const media = useMedia();

  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      compact={compact}
      autoWidthForHome
      num={num}
      linkNetworkId={linkNetworkId}
      showWalletName={media.gtMd && !compact}
    />
  );
}
