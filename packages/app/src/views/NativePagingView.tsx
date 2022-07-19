import { HostComponent, UIManager, requireNativeComponent } from 'react-native';

import type { PagingViewManagerProps } from './types';

const VIEW_MANAGER_NAME = 'PagingView';

export type PagerViewViewManagerType = HostComponent<PagingViewManagerProps>;

const NativePagingView = requireNativeComponent(
  VIEW_MANAGER_NAME,
) as PagerViewViewManagerType;

export function getViewManagerConfig(viewManagerName = VIEW_MANAGER_NAME) {
  return UIManager.getViewManagerConfig(viewManagerName);
}

export default NativePagingView;
