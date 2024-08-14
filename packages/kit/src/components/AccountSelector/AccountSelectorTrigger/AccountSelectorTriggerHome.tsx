import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerHome({ num }: { num: number }) {
  return (
    <AccountSelectorTriggerBase
      autoWidthForHome
      num={num}
      linkNetwork={false}
      editable
    />
  );
}
