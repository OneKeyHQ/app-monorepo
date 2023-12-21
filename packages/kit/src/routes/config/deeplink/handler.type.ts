import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';

export type IRegisterHandler = (
  handler: (data: IDesktopOpenUrlEventData) => void,
) => void;
