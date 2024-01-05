import type { ViewProps } from 'react-native';

export type IScanCameraProps = ViewProps & {
  handleScanResult?: (value: string) => void;
  isActive?: boolean;
};
