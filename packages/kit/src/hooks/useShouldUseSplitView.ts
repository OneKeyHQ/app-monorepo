import { isNativeTablet } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// Returns true when the device can render the split-view layout AND the user
// has not opted out. `enableSplitView` is default-on: undefined / true → on,
// only an explicit `false` disables it. Toggling the setting requires an app
// restart, so this hook's value is effectively stable per session.
export function useShouldUseSplitView(): boolean {
  const [{ enableSplitView }] = useSettingsPersistAtom();
  return isNativeTablet() && enableSplitView !== false;
}
