import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerSwap({ num }: { num: number }) {
  return <AccountSelectorTriggerBase num={num} linkNetwork={false} editable />;
}
