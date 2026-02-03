import { ForceFirmwareUpdateReminder } from '../../../views/FirmwareUpdate/components/ForceFirmwareUpdateReminder';
import { LegacyFirmwareUpdateReminder } from '../../../views/FirmwareUpdate/components/LegacyFirmwareUpdateReminder';

export function ForceFirmwareUpdateContainer() {
  return (
    <>
      <ForceFirmwareUpdateReminder />
      <LegacyFirmwareUpdateReminder />
    </>
  );
}
