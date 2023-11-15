// The View component is not exposed externally, it is only used for component layer optimization.
import type { ElementType, PropsWithChildren } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

const ViewNativeComponent: {
  default: ElementType<PropsWithChildren<{ style?: StyleProp<ViewStyle> }>>;
} = require('react-native/Libraries/Components/View/ViewNativeComponent');

export const View = ViewNativeComponent.default;
