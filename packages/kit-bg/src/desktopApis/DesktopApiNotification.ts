import { ipcRenderer } from 'electron';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type {
  INotificationPermissionDetail,
  INotificationSetBadgeParams,
  INotificationShowParams,
} from '@onekeyhq/shared/types/notification';

class DesktopApiNotification {
  showNotification(params: INotificationShowParams): void {
    ipcRenderer.send(ipcMessageKeys.NOTIFICATION_SHOW, params);
  }

  setBadge(params: INotificationSetBadgeParams): void {
    ipcRenderer.send(ipcMessageKeys.NOTIFICATION_SET_BADGE, params);
    // if windows
    if (process.platform === 'win32') {
      void ipcRenderer.invoke(
        ipcMessageKeys.NOTIFICATION_SET_BADGE_WINDOWS,
        params.count ?? 0,
      );
    }
  }

  getNotificationPermission(): INotificationPermissionDetail {
    return ipcRenderer.sendSync(ipcMessageKeys.NOTIFICATION_GET_PERMISSION);
  }
}

export default DesktopApiNotification;
