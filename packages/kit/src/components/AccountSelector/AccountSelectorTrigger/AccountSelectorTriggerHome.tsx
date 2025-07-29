import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
}: {
  num: number;
  spotlightProps?: ISpotlightProps;
}) {
  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      editable
      autoWidthForHome
      showWalletAvatar
      showWalletName={false}
      num={num}
      linkNetwork={false}
      spotlightProps={spotlightProps}
    />
  );
}
