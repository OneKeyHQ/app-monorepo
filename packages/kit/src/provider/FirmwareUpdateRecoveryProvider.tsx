import { useFirmwareUpdateSession } from '../views/FirmwareUpdate/hooks/useFirmwareUpdateSession';

export function FirmwareUpdateRecoveryProvider() {
  useFirmwareUpdateSession();
  return null;
}
