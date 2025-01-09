import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
}: {
  num: number;
  spotlightProps?: ISpotlightViewProps;
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
