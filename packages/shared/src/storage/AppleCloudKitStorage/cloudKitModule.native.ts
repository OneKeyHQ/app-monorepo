import { Platform } from 'react-native';

import type { CloudKit } from '@onekeyfe/react-native-cloud-kit-module';

type ICloudKitModule = typeof CloudKit;

const CloudKitModule: ICloudKitModule | undefined =
  Platform.OS === 'ios' && Platform.isMacCatalyst
    ? undefined
    : (
        require('@onekeyfe/react-native-cloud-kit-module') as {
          CloudKit: ICloudKitModule;
        }
      ).CloudKit;

export default CloudKitModule;
