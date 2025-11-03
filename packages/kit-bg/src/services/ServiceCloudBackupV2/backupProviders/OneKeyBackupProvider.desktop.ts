import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EmptyBackupProvider } from './EmptyBackupProvider';
import { ICloudBackupProvider } from './ICloudBackupProvider';

const OneKeyBackupProvider =
  platformEnv.isDesktop && platformEnv.isDesktopMac
    ? ICloudBackupProvider
    : EmptyBackupProvider;
export { OneKeyBackupProvider };
