import type { IOneKeyDeviceType } from '@onekeyhq/shared/types/device';

export type IHardwareHomeScreenResponse = {
  id: string;
  wallpaperType: 'default' | 'cobranding';
  resType: 'system' | 'prebuilt' | 'custom';
  url: string;
  screenHex?: string;
  nameHex?: string;
  deviceTypes: IOneKeyDeviceType[];
};
