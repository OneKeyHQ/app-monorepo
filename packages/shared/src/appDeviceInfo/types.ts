import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';

import type { IExpoDeviceData } from './utils/expoDevice';

export type IBrowserEngine =
  | 'Amaya'
  | 'ArkWeb'
  | 'Blink'
  | 'EdgeHTML'
  | 'Flow'
  | 'Gecko'
  | 'Goanna'
  | 'iCab'
  | 'KHTML'
  | 'LibWeb'
  | 'Links'
  | 'Lynx'
  | 'NetFront'
  | 'NetSurf'
  | 'Presto'
  | 'Servo'
  | 'Tasman'
  | 'Trident'
  | 'w3m'
  | 'WebKit';

export type ICPUArchitecture =
  | 'ia32'
  | 'ia64'
  | 'amd64'
  | 'arm'
  | 'arm64'
  | 'armhf'
  | 'avr'
  | 'avr32'
  | 'irix'
  | 'irix64'
  | 'mips'
  | 'mips64'
  | '68k'
  | 'pa-risc'
  | 'ppc'
  | 'sparc'
  | 'sparc64'
  | 'arm64 v8'
  | 'Intel x86-64h Haswell'
  | 'arm64-v8a'
  | 'armeabi-v7a'
  | 'armeabi';

export type IAppDeviceType =
  | 'mobile'
  | 'tablet'
  | 'desktop'
  | 'console'
  | 'smarttv'
  | 'wearable'
  | 'xr'
  | 'embedded';

export type IAppDeviceInfoData = {
  $desktopSystemInfo?: IDesktopSystemInfo;
  $expoDevice?: IExpoDeviceData;
  $uaParser?: UAParser.IResult;
  $ua?: string;
  displayName: string | undefined;
  device: {
    type: IAppDeviceType | undefined;
    vendor: string | undefined;
    model: string | undefined;
    name: string | undefined;
  };
  os: {
    name: string | undefined;
    version: string | undefined;
  };
  cpu: {
    architecture: ICPUArchitecture[] | undefined;
  };
  browser: {
    name: string | undefined;
    version: string | undefined;
    versionMajor: string | undefined;
    type:
      | 'crawler'
      | 'cli'
      | 'email'
      | 'fetcher'
      | 'inapp'
      | 'mediaplayer'
      | 'library'
      | undefined;
    engine: IBrowserEngine | undefined;
    engineVersion: string | undefined;
    ua: string | undefined;
  };
};

export type IAppDeviceInfo = {
  getDeviceInfo: () => Promise<IAppDeviceInfoData>;
};
