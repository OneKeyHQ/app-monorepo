// The View component is not exposed externally, it is only used for component layer optimization.
import type { ElementType } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives/Stack';

import type { IOptimizationViewType } from './type';

const ViewNativeComponent: {
  default: ElementType<IOptimizationViewType>;
} = require('react-native/Libraries/Components/View/ViewNativeComponent');

export * from './type';

// E2E mode needs to be enabled screenshot in Android
export const OptimizationView = platformEnv.isE2E
  ? function (props: IOptimizationViewType) {
      return <Stack {...props} />;
    }
  : ViewNativeComponent.default;
