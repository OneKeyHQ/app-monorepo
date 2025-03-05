import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';

export type IRegisterHandler = (
  handler: (data: IDesktopOpenUrlEventData) => void,
) => void;
