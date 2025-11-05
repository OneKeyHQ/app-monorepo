import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EmptyBackupProvider } from './EmptyBackupProvider';
import { ICloudBackupProvider } from './ICloudBackupProvider';

const OneKeyBackupProvider =
  platformEnv.isDesktop && platformEnv.isDesktopMac && platformEnv.isMas
    ? ICloudBackupProvider
    : EmptyBackupProvider;
export { OneKeyBackupProvider };
