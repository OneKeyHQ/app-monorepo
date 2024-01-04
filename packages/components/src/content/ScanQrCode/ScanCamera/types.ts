import type { ViewProps } from 'react-native';

export type IScanCameraProps = ViewProps & {
  onScannedCode?: (value: string) => void;
  isActive?: boolean;
};
