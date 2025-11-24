import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EmptyBackupProvider } from './EmptyBackupProvider';
import { ICloudBackupProvider } from './ICloudBackupProvider';

// Enable CloudKit for all macOS Desktop builds (both MAS and Developer ID with provisioning profile)
const OneKeyBackupProvider =
  platformEnv.isDesktop && platformEnv.isDesktopMac
    ? ICloudBackupProvider
    : EmptyBackupProvider;
export { OneKeyBackupProvider };
