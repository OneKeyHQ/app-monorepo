import platformEnv from '../../platformEnv';

import type { CloudKit } from '@onekeyfe/react-native-cloud-kit-module';

type ICloudKitModule = typeof CloudKit;

const CloudKitModule: ICloudKitModule | undefined =
  platformEnv.isNativeIOSMacCatalyst
    ? undefined
    : (
        require('@onekeyfe/react-native-cloud-kit-module') as {
          CloudKit: ICloudKitModule;
        }
      ).CloudKit;

export default CloudKitModule;
