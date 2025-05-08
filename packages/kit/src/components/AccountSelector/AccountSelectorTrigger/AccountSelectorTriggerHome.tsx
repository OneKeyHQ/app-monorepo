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
      horizontalLayout
      editable
      autoWidthForHome
      num={num}
      linkNetwork={false}
      spotlightProps={spotlightProps}
    />
  );
}
