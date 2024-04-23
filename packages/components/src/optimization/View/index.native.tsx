// The View component is not exposed externally, it is only used for component layer optimization.
import type { ElementType } from 'react';

import type { IOptimizationViewType } from './type';

const ViewNativeComponent: {
  default: ElementType<IOptimizationViewType>;
} = require('react-native/Libraries/Components/View/ViewNativeComponent');

export * from './type';
export const OptimizationView = ViewNativeComponent.default;
