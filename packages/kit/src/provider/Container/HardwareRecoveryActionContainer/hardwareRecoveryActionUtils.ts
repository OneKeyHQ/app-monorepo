import type { IThirdPartyHardwareRecoveryAction } from '@onekeyhq/shared/src/eventBus/appEventBus';

export type ILedgerAppInstallRecoveryItem = Extract<
  IThirdPartyHardwareRecoveryAction,
  { type: 'ledger_app_install_required' }
> & {
  key: string;
  sources: NonNullable<
    Extract<
      IThirdPartyHardwareRecoveryAction,
      { type: 'ledger_app_install_required' }
    >['source']
  >[];
};

export function buildLedgerAppInstallRequestKey(
  request: Extract<
    IThirdPartyHardwareRecoveryAction,
    { type: 'ledger_app_install_required' }
  >,
) {
  return [request.vendor, request.connectId || '', request.appName].join(':');
}

export function mergeLedgerAppInstallRequests(
  currentItems: ILedgerAppInstallRecoveryItem[],
  requests: IThirdPartyHardwareRecoveryAction[],
): ILedgerAppInstallRecoveryItem[] {
  const itemMap = new Map(
    currentItems.map((item) => [item.key, { ...item, sources: item.sources }]),
  );

  for (const request of requests) {
    if (request.type === 'ledger_app_install_required' && !request.silent) {
      const key = buildLedgerAppInstallRequestKey(request);
      const current = itemMap.get(key);
      if (current) {
        if (request.source && !current.sources.includes(request.source)) {
          current.sources = [...current.sources, request.source];
        }
        itemMap.set(key, current);
      } else {
        itemMap.set(key, {
          ...request,
          key,
          sources: request.source ? [request.source] : [],
        });
      }
    }
  }

  return Array.from(itemMap.values());
}
