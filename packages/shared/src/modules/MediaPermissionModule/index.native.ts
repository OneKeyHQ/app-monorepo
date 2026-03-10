import { NativeModules } from 'react-native';

const { MediaPermissionModule } = NativeModules;

export default MediaPermissionModule as
  | {
      setMediaPermissionWhitelist: (origins: string[]) => void;
    }
  | undefined;
