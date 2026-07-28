import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

export function AccountSelectorTriggerBulkExportHistory({
  num,
  disabled,
}: {
  num: number;
  disabled?: boolean;
}) {
  return (
    <AccountSelectorTriggerBase
      num={num}
      disabled={disabled}
      linkNetwork={false}
      showWalletName
      showWalletAvatar
      horizontalLayout
      containerProps={{
        borderRadius: '$3',
        borderWidth: 1,
        borderCurve: 'continuous',
        borderColor: '$borderStrong',
        mx: '$0',
        px: '$3',
        py: '$2.5',
      }}
    />
  );
}
