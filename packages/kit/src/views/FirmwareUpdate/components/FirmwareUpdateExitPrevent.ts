import { useKeepAwake } from 'expo-keep-awake';

import {
  useAppExitPrevent,
  useModalExitPrevent,
} from '../hooks/useFirmwareUpdateHooks';

export function FirmwareUpdateExitPrevent() {
  const message = '确定要取消固件更新吗？';
  const title = '退出更新';

  // Prevents screen locking
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({ message, title });

  // Prevent App exit
  useAppExitPrevent({ message, title });

  // Prevent lockApp:       check servicePassword.lockApp()
  return null;
}
