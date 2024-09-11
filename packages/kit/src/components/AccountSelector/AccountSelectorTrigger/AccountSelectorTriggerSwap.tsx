import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerSwap({ num }: { num: number }) {
  return (
    <AccountSelectorTriggerBase
      autoWidthForHome
      num={num}
      linkNetwork={false}
      editable
    />
  );
}
