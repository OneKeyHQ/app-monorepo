import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export interface INativeHomePageViewProps {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
}
