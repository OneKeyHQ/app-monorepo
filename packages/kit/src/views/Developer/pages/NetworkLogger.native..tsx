import NativeNetworkLogger from 'react-native-network-logger';

import { useThemeVariant } from '../../../hooks/useThemeVariant';

export default function NetworkLogger() {
  const themeVariant = useThemeVariant();
  return <NativeNetworkLogger theme={themeVariant} />;
}
