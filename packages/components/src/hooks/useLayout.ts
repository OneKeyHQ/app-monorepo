import useProviderIsVerticalLayout from '../hocs/Provider/hooks/useProviderIsVerticalLayout';

export { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useIsVerticalLayout() {
  return useProviderIsVerticalLayout();
}
