import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ForceFirmwareUpdateReminder } from '../../../views/FirmwareUpdate/components/ForceFirmwareUpdateReminder';

export function ForceFirmwareUpdateContainer() {
  const [isLocked] = useAppIsLockedAtom();

  return isLocked ? null : <ForceFirmwareUpdateReminder />;
}
