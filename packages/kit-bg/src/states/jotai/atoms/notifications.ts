/* eslint-disable @typescript-eslint/no-unused-vars */
import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type INotificationsAtomData = {
  firstTimeGuideOpened: boolean | undefined;
  badge: number | undefined;
  lastReceivedTime: number | undefined;
  lastRegisterTime: number | undefined;
};
export const { target: notificationsAtom, use: useNotificationsAtom } =
  globalAtom<INotificationsAtomData>({
    name: EAtomNames.notificationsAtom,
    persist: true,
    initialValue: {
      firstTimeGuideOpened: undefined,
      badge: undefined,
      lastReceivedTime: undefined,
      lastRegisterTime: undefined,
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
