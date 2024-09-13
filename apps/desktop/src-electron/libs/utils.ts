import fs from 'fs';
import path from 'path';

import plist from '@expo/plist';
import { app } from 'electron';

// Bool 2 Text
export const b2t = (bool: boolean) => (bool ? 'Yes' : 'No');

const units = ['B', 'KB', 'MB', 'GB', 'TB'];

export const toHumanReadable = (bytes: number): string => {
  let size = Math.abs(bytes);
  let i = 0;

  while (size >= 1024 || i >= units.length) {
    size /= 1024;
    i += 1;
  }

  return `${size.toFixed(1)} ${units[i]}`;
};

export interface IMacBundleInfo {
  'CFBundleDisplayName': string;
  'CFBundleExecutable': string;
  'CFBundleIconFile': string;
  'CFBundleIdentifier': string;
  'CFBundleInfoDictionaryVersion': string;
  'CFBundleName': string;
  'CFBundlePackageType': string;
  'CFBundleShortVersionString': string;
  'CFBundleVersion': string;
  'DTCompiler': string;
  'DTSDKBuild': string;
  'DTSDKName': string;
  'DTXcode': string;
  'DTXcodeBuild': string;
  'ElectronAsarIntegrity': string;
  'LSApplicationCategoryType': string;
  'LSEnvironment': string;
  'LSMinimumSystemVersion': string;
  'NSAppTransportSecurity': string;
  'NSBluetoothAlwaysUsageDescription': string;
  'NSBluetoothPeripheralUsageDescription': string;
  'NSCameraUsageDescription': string;
  'NSHighResolutionCapable': string;
  'NSMainNibFile': string;
  'NSMicrophoneUsageDescription': string;
  'NSPrincipalClass': string;
  'NSQuitAlwaysKeepsWindows': string;
  'NSRequiresAquaSystemAppearance': string;
  'NSSupportsAutomaticGraphicsSwitching': string;
}

let cachedMacBundleInfo: IMacBundleInfo | null = null;
export const parseContentPList = () => {
  if (cachedMacBundleInfo) {
    return cachedMacBundleInfo;
  }
  try {
    const appPath = app.getPath('exe');
    const pListPath = path.join(
      appPath.split('Contents')[0],
      'Contents',
      'Info.plist',
    );
    if (fs.existsSync(pListPath)) {
      const pListString = fs.readFileSync(pListPath, 'utf8');
      cachedMacBundleInfo = plist.parse(pListString) as IMacBundleInfo;
      return cachedMacBundleInfo;
    }
  } catch (e) {
    return {} as IMacBundleInfo;
  }
};

export const getMacAppId = () => {
  const bundleInfo = parseContentPList();
  return bundleInfo?.CFBundleIdentifier || '';
};
