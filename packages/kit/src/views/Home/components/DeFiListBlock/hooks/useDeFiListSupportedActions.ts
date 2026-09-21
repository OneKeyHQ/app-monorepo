import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDeFiListActions } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';

export function useDeFiListSupportedActions({
  refreshCacheOnly,
  isFocused,
  isDeFiEnabled,
}: {
  refreshCacheOnly: boolean;
  isFocused: boolean;
  isDeFiEnabled: boolean;
}) {
  const { updateDeFiListSupportedActions } = useDeFiListActions().current;
  usePromiseResult(
    async () => {
      if (refreshCacheOnly || !isDeFiEnabled) {
        updateDeFiListSupportedActions({ supportedActions: [] });
        return;
      }
      try {
        const supportedActions =
          await backgroundApiProxy.serviceDeFi.fetchSupportedDeFiProtocols();
        updateDeFiListSupportedActions({ supportedActions });
      } catch (error) {
        console.error(error);
        updateDeFiListSupportedActions({ supportedActions: [] });
      }
    },
    [refreshCacheOnly, isDeFiEnabled, updateDeFiListSupportedActions],
    { overrideIsFocused: (pageFocused) => pageFocused && isFocused },
  );
}
