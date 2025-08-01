import { useMedia } from '@onekeyhq/components';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerRewardCenter({ num }: { num: number }) {
  const media = useMedia();

  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      autoWidthForHome
      num={num}
      linkNetwork={false}
      showWalletName={media.gtMd}
    />
  );
}
