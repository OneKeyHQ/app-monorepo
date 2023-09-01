import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function useContacts() {
  const refreshContactsTs = useAppSelector(
    (s) => s.refresher.refreshContactsTs,
  );
  const data = usePromiseResult(
    () => backgroundApiProxy.serviceAddressbook.getItems(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshContactsTs],
  );
  return data.result ?? [];
}
