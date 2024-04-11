import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerHome({ num }: { num: number }) {
  return <AccountSelectorTriggerBase num={num} linkNetwork={false} editable />;
}
