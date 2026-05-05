/* eslint-disable @typescript-eslint/no-unused-vars */
import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type INotificationsPersistAtomData = {
  firstTimeGuideOpened: boolean | undefined;
  badge: number | undefined;
  lastReceivedTime: number | undefined;
  lastRegisterTime: number | undefined;
  maxAccountCount: number | undefined;
  lastSettingsUpdateTime: number | undefined;
  // Alert dismissed states for different history lists
  txHistoryAlertDismissed: boolean | undefined;
  swapHistoryAlertDismissed: boolean | undefined;
  perpHistoryAlertDismissed: boolean | undefined;
};
export const {
  target: notificationsAtom, // persist
  use: useNotificationsAtom,
} = globalAtom<INotificationsPersistAtomData>({
  name: EAtomNames.notificationsAtom,
  persist: true,
  initialValue: {
    firstTimeGuideOpened: undefined,
    badge: undefined,
    lastReceivedTime: undefined,
    lastRegisterTime: undefined,
    lastSettingsUpdateTime: undefined,
    maxAccountCount: undefined,
    txHistoryAlertDismissed: undefined,
    swapHistoryAlertDismissed: undefined,
    perpHistoryAlertDismissed: undefined,
  },
});

export const {
  target: notificationsReadedAtom,
  use: useNotificationsReadedAtom,
} = globalAtom<{
  [msgId: string]: boolean;
}>({
  name: EAtomNames.notificationsReadedAtom,
  initialValue: {},
});

export type INotificationStatusAtomData = {
  websocketConnected: boolean;
};
export const {
  target: notificationStatusAtom,
  use: useNotificationStatusAtom,
} = globalAtom<INotificationStatusAtomData>({
  name: EAtomNames.notificationStatusAtom,
  initialValue: {
    websocketConnected: false,
  },
});
