import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerRewardCenter({ num }: { num: number }) {
  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      autoWidthForHome
      num={num}
      linkNetwork={false}
    />
  );
}
