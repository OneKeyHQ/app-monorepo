export type ITradingGuardRenderMode =
  | 'selectAccountLoading'
  | 'accountNotSupport'
  | 'guardedChildren'
  | 'enableTradingButton'
  | 'children';

export function getTradingGuardRenderMode({
  selectAccountLoading,
  accountNotSupport,
  shouldShowEnableTrading,
  hasChildren,
  canRunGuardedAction,
}: {
  selectAccountLoading: boolean;
  accountNotSupport: boolean;
  shouldShowEnableTrading: boolean;
  hasChildren: boolean;
  canRunGuardedAction: boolean;
}): ITradingGuardRenderMode {
  if (selectAccountLoading) {
    return 'selectAccountLoading';
  }
  if (accountNotSupport) {
    return 'accountNotSupport';
  }
  if (shouldShowEnableTrading && canRunGuardedAction) {
    return 'guardedChildren';
  }
  if (shouldShowEnableTrading || !hasChildren) {
    return 'enableTradingButton';
  }
  return 'children';
}
