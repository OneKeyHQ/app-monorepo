import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerSwap({ num }: { num: number }) {
  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      autoWidthForHome
      num={num}
      linkNetwork={false}
      editable
    />
  );
}
