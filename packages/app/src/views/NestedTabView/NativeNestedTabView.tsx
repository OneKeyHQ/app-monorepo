import { UIManager, requireNativeComponent } from 'react-native';

import type { NativeNestedTabViewProps } from './types';
import type { HostComponent } from 'react-native';

const VIEW_MANAGER_NAME = 'NestedTabView';

export type PagerViewViewManagerType = HostComponent<NativeNestedTabViewProps>;

const NativeNestedTabView = requireNativeComponent(
  VIEW_MANAGER_NAME,
) as PagerViewViewManagerType;

export function getViewManagerConfig(viewManagerName = VIEW_MANAGER_NAME) {
  return UIManager.getViewManagerConfig(viewManagerName);
}

export default NativeNestedTabView;
