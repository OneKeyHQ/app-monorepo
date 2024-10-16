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
      editable
      autoWidthForHome
      num={num}
      linkNetwork={false}
      spotlightProps={spotlightProps}
    />
  );
}
