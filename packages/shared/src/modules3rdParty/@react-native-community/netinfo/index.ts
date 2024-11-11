import { useNetInfo as useNetInfoNative } from '@react-native-community/netinfo';

export * from '@react-native-community/netinfo';

export const useNetInfo = () => {
  const { isConnected, isInternetReachable, isWifiEnabled, type } =
    useNetInfoNative();
  return {
    type,
    isConnected,
    // The initial value of isInternetReachable is null, and it is treated as true at the UI layer.
    isInternetReachable: isInternetReachable !== false,
    isRawInternetReachable: isInternetReachable,
    isWifiEnabled,
  };
};
