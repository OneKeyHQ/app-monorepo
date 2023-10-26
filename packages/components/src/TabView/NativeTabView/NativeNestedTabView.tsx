import type { NativeNestedTabViewProps } from './types';
import type { HostComponent } from 'react-native';

import NestedTabView from 'react-native-tab-page-view';

export type PagerViewViewManagerType = HostComponent<NativeNestedTabViewProps>;

export default NestedTabView as PagerViewViewManagerType;
