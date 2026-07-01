export type IConfirmedUserAbstractionMode =
  | 'unifiedAccount'
  | 'portfolioMargin';

export function shouldPreserveConfirmedUserAbstractionMode({
  confirmedMode,
  refreshedMode,
}: {
  confirmedMode?: IConfirmedUserAbstractionMode;
  refreshedMode?: string;
}) {
  return Boolean(confirmedMode && refreshedMode !== confirmedMode);
}
