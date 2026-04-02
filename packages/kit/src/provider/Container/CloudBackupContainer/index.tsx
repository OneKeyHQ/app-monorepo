import { useCloudBackupExitPreventAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { CloudBackupExitPrevent } from '../../../views/Onboardingv2/components/CloudBackupExitPrevent';

export function CloudBackupContainer() {
  const [{ shouldPreventExit }] = useCloudBackupExitPreventAtom();
  if (shouldPreventExit === true) {
    return <CloudBackupExitPrevent shouldPreventRemove={shouldPreventExit} />;
  }
  return null;
}
